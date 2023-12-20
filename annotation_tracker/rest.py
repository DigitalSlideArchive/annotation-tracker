from math import ceil, floor

import large_image
import numpy as np
from bson.objectid import ObjectId
from girder.api import access
from girder.api.describe import Description, autoDescribeRoute
from girder.api.rest import Resource, setRawResponse, setResponseHeader
from girder.constants import SortDir, TokenScope
from girder_large_image.models.image_item import ImageItem
from PIL import Image

from .models import Activity


class AnnotationTrackerResource(Resource):
    def __init__(self):
        super().__init__()
        self.resourceName = "annotation_tracker"

        self.route("POST", ("log",), self.logActivity)
        self.route("GET", (), self.find)
        self.route("GET", ("pan_history",), self.pan_history)
        self.route("GET", ("pan_history_json",), self.pan_history_json)

    @autoDescribeRoute(
        Description("Log activity to the database.")
        .notes(
            "The return value is a dictionary of session identifiers, each "
            "with a list of sequenceIds that were logged."
        )
        .jsonParam("activityList", "The key to reimport.", paramType="body")
    )
    @access.public
    def logActivity(self, activityList):
        """
        The activityList is a json-encoded list of objects.  Each object must
        have:
        :param session: a unique string identifier for the user's browsing
            session.
        :param sequenceId: a monotonically increasing activity id for the
            session.  This is used for deduplication.
        :param epochms: the browser's time in milliseconds.
        :param activity: the action being reported.  Typically one of
            session/move/mousedown/mouseup/keydown/keyup/experiment
        There are additional properties based on the activity.

        session activity:
        :param currentImage: item id or None
        :param visibleArea: the corners of the current display in image pixel
            coordinates in the form {tl: {x: <x>, y: <y>}, tr: {x: <x>, y:
            <y>}, bl: {x: <x>, y: <y>}, br: {x: <x>, y: <y>}}
        :param screenSize: in pixels in the form {width: <width>, height:
            <height>}
        :param rotation: in radians.
        :param userId: a Girder user id or None.
        :param hasFocus: boolean.  true if the tab has focus.

        mousemove/mousedown/mouseup activity:
        :param button: left/center/right (not present for mousemove)
        :param mouse: {x: <x>, y: <y>} relative to the browser window.
        :param buttonsDown: a list of left/center/right.  Not present means
            none down.

        keydown/keyup activity:
        :param key: <key code>

        experiment activity:
        :param experimentState: start/pause/stop/next
        :param experimentId: <id>
        """
        saved = Activity().createActivityList(activityList)
        results = {}
        for entry in saved:
            results.setdefault(entry["session"], set()).add(entry["sequenceId"])
        for key in list(results.keys()):
            results[key] = sorted(results[key])
        return results

    @access.admin(scope=TokenScope.DATA_READ)
    @autoDescribeRoute(
        Description("List or search for activities.")
        .responseClass("Activity", array=True)
        .param("sessionId", "A session id", required=False)
        .param("userId", "A user id", required=False)
        .param("activity", "An activity string", required=False)
        .jsonParam(
            "query",
            "Find activities that match this Mongo query.",
            required=False,
            requireObject=True,
        )
        .pagingParams(defaultSort="epochms", defaultSortDir=SortDir.DESCENDING)
        .errorResponse()
    )
    def find(self, sessionId, userId, activity, query, limit, offset, sort):
        """Get a list of activities with given search parameters."""
        query = query or {}
        if sessionId:
            query["session"] = sessionId
        if userId:
            query["userId"] = userId
        if activity:
            query["activity"] = activity
        return Activity().find(query, offset=offset, limit=limit, sort=sort)

    def activity_rois(
        self, imageId, startTime, endTime, zoomThreshold, limit, offset, sort
    ):
        """Get a list of pan events for a given image and time range."""
        query = {
            "currentImage": imageId,
            "epochms": {"$gte": startTime, "$lte": endTime},
            "activity": "pan",
        }
        events = Activity().find(
            query,
            offset=offset,
            limit=limit,
            sort=sort,
            fields=["epochms", "visibleArea", "zoom"],
        )
        if events.count() == 0:
            return None

        # filter out events that are not close to an integer zoom
        def zoom_threshold(zoom):
            return abs(zoom - round(zoom)) < zoomThreshold

        events = [e for e in events if zoom_threshold(e["zoom"])]

        return events

    @access.admin(scope=TokenScope.DATA_READ)
    @autoDescribeRoute(
        Description("Generate image thumbnail displaying HistomicsUI panning history.")
        .param("imageId", "Image's item id", required=True)
        .param(
            "startTime",
            "Start of timeframe to examine (epochms)",
            dataType="integer",
            required=True,
        )
        .param(
            "endTime",
            "End of timeframe to examine (epochms)",
            dataType="integer",
            required=True,
        )
        .param(
            "zoomThreshold",
            "Maximum distance zoom variable can be from an interger",
            dataType="float",
            default="0.001",
            required=False,
        )
        .pagingParams(defaultSort="epochms", defaultSortDir=SortDir.DESCENDING)
        .errorResponse()
    )
    def pan_history(
        self, imageId, startTime, endTime, zoomThreshold, limit, offset, sort
    ):
        events = self.activity_rois(
            imageId, startTime, endTime, zoomThreshold, limit, offset, sort
        )
        if not events:
            return None

        image = ImageItem().findOne({"_id": ObjectId(imageId)})
        meta = ImageItem().getMetadata(image)
        if not meta or "sizeX" not in meta:
            return None

        dest = large_image.new()
        scales = {}

        for e in events:
            tl = e["visibleArea"]["tl"]
            br = e["visibleArea"]["br"]

            # assuming that we know the image size and can zero-out negative values
            min_x, max_x = max(floor(tl["x"]), 0), max(ceil(br["x"]), 0)
            min_y, max_y = max(floor(tl["y"]), 0), max(ceil(br["y"]), 0)

            zoom = e["zoom"]
            if zoom not in scales:
                scales[zoom] = {
                    "region": {
                        "left": min_x,
                        "right": max_x,
                        "top": min_y,
                        "bottom": max_y,
                    },
                    "mask": np.zeros((meta["sizeY"], meta["sizeX"]), dtype="uint8"),
                }
            else:
                region = scales[zoom]["region"]
                scales[zoom]["region"]["left"] = min(min_x, region["left"])
                scales[zoom]["region"]["right"] = max(max_x, region["right"])
                scales[zoom]["region"]["top"] = min(min_y, region["top"])
                scales[zoom]["region"]["bottom"] = max(max_y, region["bottom"])

            # set the mask for this region
            scales[zoom]["mask"][min_y:max_y, min_x:max_x] = 1

        for zoom in sorted(scales.keys()):
            item = scales[zoom]
            region = item["region"]

            # assuming that the default scaling for the image is 20x (on zoom=4)
            effective_mag = (meta.get("magnification", 20) / 2**4) * (2**zoom)

            nparray, mime_type = ImageItem().getRegion(
                image,
                region=region,
                resample=Image.Resampling.NEAREST,
                scale={"magnification": effective_mag},
                format=large_image.constants.TILE_FORMAT_NUMPY,
            )

            upscale_factor = 2 ** (meta["levels"] - 1 - zoom)
            nparray = nparray.repeat(upscale_factor, axis=0).repeat(
                upscale_factor, axis=1
            )

            mask = item["mask"][
                region["top"] : region["bottom"], region["left"] : region["right"]
            ]
            mask = mask.copy()  # copy to avoid modifying the original in resize
            mask.resize(nparray.shape[:2])

            dest.addTile(nparray, x=region["left"], y=region["top"], mask=mask)

        data, mime = dest.getRegion()
        setResponseHeader("Content-Type", mime)
        setRawResponse()
        return data

    @access.admin(scope=TokenScope.DATA_READ)
    @autoDescribeRoute(
        Description("Return JSON list of ROI bounding boxes for given image/timeframe.")
        .param("imageId", "Image's item id", required=True)
        .param(
            "startTime",
            "Start of timeframe to examine (epochms)",
            dataType="integer",
            required=True,
        )
        .param(
            "endTime",
            "End of timeframe to examine (epochms)",
            dataType="integer",
            required=True,
        )
        .param(
            "zoomThreshold",
            "Maximum distance zoom variable can be from an interger",
            dataType="float",
            default="0.001",
            required=False,
        )
        .pagingParams(defaultSort="epochms", defaultSortDir=SortDir.DESCENDING)
        .errorResponse()
    )
    def pan_history_json(
        self, imageId, startTime, endTime, zoomThreshold, limit, offset, sort
    ):
        return self.activity_rois(
            imageId, startTime, endTime, zoomThreshold, limit, offset, sort
        )
