from girder import plugin
from girder.utility.model_importer import ModelImporter

from .rest import AnnotationTrackerResource
from .models import Activity


class GirderPlugin(plugin.GirderPlugin):
    DISPLAY_NAME = 'Annotation Tracker'
    CLIENT_SOURCE_PATH = 'web_client'

    def load(self, info):
        plugin.getPlugin('histomicsui').load(info)

        ModelImporter.registerModel('activity', Activity, 'annotation_tracker')
        info['apiRoot'].annotation_tracker = AnnotationTrackerResource()
