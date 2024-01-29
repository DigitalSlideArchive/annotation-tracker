import os
import tempfile

import large_image
import numpy as np
import yaml
from bson.objectid import ObjectId
from girder.api import access
from girder.api.describe import Description, autoDescribeRoute
from girder.api.rest import Resource
from girder.constants import SortDir, TokenScope
from girder.models.folder import Folder
from girder.models.upload import Upload
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

    def overlap_th(self, roi, rois, threshold=0.95):
        # assuming roi and rois are uniformly sized
        # rois being the list of rois used until this point

        if len(rois) == 0:
            return True

        def overlap_area(a, b):
            return max(0, min(a['right'], b['right']) - max(a['left'], b['left'])) * \
                   max(0, min(a['bottom'], b['bottom']) - max(a['top'], b['top']))

        # find the most overlapping roi so far
        max_overlap = 0
        for r in rois:
            area = overlap_area(roi, r)
            if area > max_overlap:
                max_overlap = area

        roi_area = (roi["left"] - roi["right"]) * (roi["top"] - roi["bottom"])

        # if the max overlap proportion is less than the minimum threshold, we can add this roi
        return (max_overlap / roi_area) < threshold

    def spatial_downsample(self, events, threshold=0.95):
        scales = {}

        for e in events:
            tl = e["visibleArea"]["tl"]
            br = e["visibleArea"]["br"]

            roi = {"top": tl["y"], "left": tl["x"], "bottom": br["y"], "right": br["x"]}
            roi = {k: max(0, int(v)) for k, v in roi.items()}  # clamp pixels to be greater than 0
                                                               # this is needed for getRegion
            roi["epochms"] = e["epochms"]

            zoom = e["rounded_zoom"]
            if zoom not in scales:
                scales[zoom] = {"rois": [roi]}
            else:
                scales[zoom]["rois"].append(roi)

        for zoom, regions in sorted(scales.items()):
            regions = regions["rois"]

            accepted_regions = []
            for roi in regions:
                if self.overlap_th(roi, accepted_regions, threshold=threshold):
                    accepted_regions.append(roi)

            scales[zoom]["accepted_regions"] = accepted_regions

        return scales

    def activity_rois(
        self, imageId, startTime, endTime, zoomPrecision, limit, offset, sort
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
            return abs(zoom - round(zoom)) < zoomPrecision

        # filter events based on zoom value proximity & store the rounded zoom value
        events = [
            {**e, "rounded_zoom": round(e["zoom"])}
            for e in events
            if zoom_threshold(e["zoom"])
        ]

        return events

    @access.admin(scope=TokenScope.DATA_READ)
    @autoDescribeRoute(
        Description("Generate image thumbnail displaying HistomicsUI panning history.")
        .param("imageId", "Image's item id", required=True)
        .param("destFolder", "Destination folder id", required=True)
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
            "zoomPrecision",
            "Maximum deviance zoom variable can be from a round interger value",
            dataType="float",
            default="0.001",
            required=False,
        )
        .param(
            "areaThreshold",
            "Minimum ratio of (rectangle area overlap / rectangle area) before resampling occurs",
            dataType="float",
            default="0.95",
            required=False,
        )
        .pagingParams(defaultSort="epochms", defaultSortDir=SortDir.DESCENDING)
        .errorResponse()
    )
    def pan_history(
        self, imageId, destFolder, startTime, endTime, zoomPrecision, areaThreshold, limit, offset, sort
    ):
        events = self.activity_rois(
            imageId, startTime, endTime, zoomPrecision, limit, offset, sort
        )
        if not events:
            return None

        user = self.getCurrentUser()
        folder = Folder().load(destFolder, user=user)

        image = ImageItem().findOne({"_id": ObjectId(imageId)})
        meta = ImageItem().getMetadata(image)
        if not meta or "sizeX" not in meta:
            return None
        image_name = os.path.splitext(image["name"])[0]  # filename without extension

        # collect roi's based on spatial downsampling
        scales = self.spatial_downsample(events, threshold=areaThreshold)

        origin = None
        min_xys = {}

        with tempfile.TemporaryDirectory() as tempdir:
            for zoom, data in sorted(scales.items()):
                # discard roi's with scale larger than limit
                if zoom >= meta["levels"]:
                    continue

                # assuming that the default scaling for the image is 20x (on zoom==meta["levels"]-1)
                upscale_factor = 2 ** (meta["levels"] - 1 - zoom)
                effective_mag = meta.get("magnification", 20) / upscale_factor

                min_xy = None
                scale_image = large_image.new()

                for region in data["accepted_regions"]:
                    if origin is None:
                        center_x = (region["left"] + region["right"]) // 2
                        center_y = (region["top"] + region["bottom"]) // 2
                        origin = np.array([center_x, center_y])

                    # get pixel data for roi at given magnification
                    nparray, mime = ImageItem().getRegion(
                        image,
                        region=region,
                        resample=Image.Resampling.NEAREST,
                        scale={"magnification": effective_mag},
                        format=large_image.constants.TILE_FORMAT_NUMPY,
                    )

                    region = np.array([region["left"], region["top"]])
                    translated = region - origin

                    # track the bounds of the scale_image w.r.t. the origin
                    if min_xy is None:
                        min_xy = translated
                    min_xy = np.min([min_xy, translated], axis=0)

                    # transform to scale_image coordinates via the upscale_factor
                    translated //= upscale_factor
                    scale_image.addTile(nparray, x=translated[0], y=translated[1])

                min_xys[zoom] = min_xy

                file_name = f"zoom_{zoom}_{image_name}.tiff"
                file_path = os.path.join(tempdir, file_name)
                scale_image.write(file_path, lossy=False)

                # add the file to girder instance
                with open(file_path, "rb") as scale_image_file:
                    Upload().uploadFromFile(
                        scale_image_file,
                        os.path.getsize(file_path),
                        file_name,
                        parentType="folder",
                        parent=folder,
                        user=user,
                    )

            # get the minimum x & y across all scales
            global_min_xy = np.min(np.array(list(min_xys.values())), axis=0)

            source_list = []
            for zoom in sorted(min_xys.keys()):
                upscale_factor = 2 ** (meta["levels"] - 1 - zoom)
                position = min_xys[zoom] - global_min_xy

                source_list.append(
                    {
                        "path": f"./zoom_{zoom}_{image_name}.tiff",
                        "z": 0,
                        "position": {
                            "x": int(position[0]),
                            "y": int(position[1]),
                            "scale": upscale_factor,
                        },
                        # # TODO: including band styles for multiple sources in the same tile can break compositing
                        # 'params': {'style': {'bands': [
                        #     {'palette': '#f00', 'band': 1},
                        #     {'palette': '#0f0', 'band': 2},
                        #     {'palette': '#00f', 'band': 3},
                        # ]}}
                    }
                )

            file_name = f"composite_{image_name}.yml"
            file_path = os.path.join(tempdir, file_name)

            with open(file_path, "w") as yml_file:
                yml_file.write(f'---\n{yaml.dump({"sources": source_list})}')

            with open(file_path, "rb") as yml_file:
                return Upload().uploadFromFile(
                    yml_file,
                    os.path.getsize(file_path),
                    file_name,
                    parentType="folder",
                    parent=folder,
                    user=user,
                )

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
            "zoomPrecision",
            "Maximum distance zoom variable can be from an interger",
            dataType="float",
            default="0.001",
            required=False,
        )
        .param(
            "areaThreshold",
            "Minimum ratio of (rectangle area overlap / rectangle area) before resampling occurs",
            dataType="float",
            default="0.95",
            required=False,
        )
        .pagingParams(defaultSort="epochms", defaultSortDir=SortDir.DESCENDING)
        .errorResponse()
    )
    def pan_history_json(
        self, imageId, startTime, endTime, zoomPrecision, areaThreshold, limit, offset, sort
    ):
        events = self.activity_rois(imageId, startTime, endTime, zoomPrecision, limit, offset, sort)
        return self.spatial_downsample(events, threshold=areaThreshold)
