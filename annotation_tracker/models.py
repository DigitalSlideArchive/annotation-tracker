from girder.constants import SortDir
from girder.exceptions import ValidationException
from girder.models.model_base import Model


class Activity(Model):
    # This is NOT an access controlled model; it is expected that all endpoints
    # will be sensibly guarded instead.

    def initialize(self):
        self.name = 'activity'
        self.ensureIndices([
            'session',
            'sequenceId',
            'activity',
            ([
                ('session', SortDir.ASCENDING),
                ('sequenceId', SortDir.ASCENDING),
            ], {}),
        ])

    def createActivity(self, session, sequenceId, epochms, **kwargs):
        """
        Create a new activity record if it is not already present.

        :param session: a unique string identifier for the activity session.
        :param sequenceId: a monotonically increasing activity id for the
            session.  This is used for deduplication.
        :param epochms: the browser's time in milliseconds.
        :param activity: the action being reported.  Typically one of
            session/move/mousedown/mouseup/keydown/keyup/experiment
        """
        activity = self.findOne({'session': session, 'sequenceId': sequenceId})
        if not activity:
            activity = dict(
                session=session,
                sequenceId=sequenceId,
                epochms=float(epochms),
                **kwargs,
            )
            activity = self.save(activity)
        return activity

    def createActivityList(self, activityList):
        return [self.createActivity(**entry) for entry in activityList]

    def validate(self, doc):
        if not doc.get('session') or not isinstance(doc['session'], str):
            raise ValidationException('Activity session must be a string')
        if ('sequenceId' not in doc or not isinstance(doc['sequenceId'], int) or
                doc['sequenceId'] < 0):
            raise ValidationException('Activity sequenceId must be a non-negative integer')
        if 'epochms' not in doc or not isinstance(doc['epochms'], (int, float)):
            raise ValidationException('Activity epochms must be a number')
        doc['epochms'] = float(doc['epochms'])
        if not doc.get('activity') or not isinstance(doc['activity'], str):
            raise ValidationException('Activity activity must be a string')
        return doc
