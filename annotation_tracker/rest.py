from girder.api import access
from girder.constants import TokenScope, SortDir
from girder.api.rest import Resource
from girder.api.describe import autoDescribeRoute, Description

from .models import Activity


class AnnotationTrackerResource(Resource):
    def __init__(self):
        super().__init__()
        self.resourceName = 'annotation_tracker'

        self.route('POST', ('log', ), self.logActivity)
        self.route('GET', (), self.find)

    @autoDescribeRoute(
        Description('Log activity to the database.')
        .notes('The return value is a dictionary of session identifiers, each '
               'with a list of sequenceIds that were logged.')
        .jsonParam('activityList', 'The key to reimport.', paramType='body')
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
            results.setdefault(entry['session'], set()).add(entry['sequenceId'])
        for key in list(results.keys()):
            results[key] = sorted(results[key])
        return results

    @access.admin(scope=TokenScope.DATA_READ)
    @autoDescribeRoute(
        Description('List or search for activities.')
        .responseClass('Activity', array=True)
        .param('sessionId', 'A session id', required=False)
        .param('userId', 'A user id', required=False)
        .param('activity', 'An activity string', required=False)
        .jsonParam('query', 'Find activities that match this Mongo query.',
                   required=False, requireObject=True)
        .pagingParams(defaultSort='epochms', defaultSortDir=SortDir.DESCENDING)
        .errorResponse()
    )
    def find(self, sessionId, userId, activity, query, limit, offset, sort):
        """Get a list of activities with given search parameters."""
        query = query or {}
        if sessionId:
            query['sessionId'] = sessionId
        if userId:
            query['userId'] = userId
        if activity:
            query['activity'] = activity
        return Activity().find(query, offset=offset, limit=limit, sort=sort)
