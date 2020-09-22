import pytest

from girder.plugin import loadedPlugins


@pytest.mark.plugin('girder_tulane')
def test_import(server):
    assert 'girder_tulane' in loadedPlugins()
