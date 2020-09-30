import pytest

from girder.plugin import loadedPlugins


@pytest.mark.plugin('annotation_tracker')
def test_import(server):
    assert 'annotation_tracker' in loadedPlugins()
