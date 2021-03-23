import json
import os
import sys
import tempfile

from girder.models.assetstore import Assetstore
from girder.models.collection import Collection
from girder.models.folder import Folder
from girder.models.item import Item
from girder.models.upload import Upload
from girder.models.user import User
from girder.utility.server import configureServer

import girder_client

from girder_large_image.models.image_item import ImageItem


def get_sample_data(adminUser, collName='Sample Images', folderName='Images'):
    """
    As needed, download sample data.

    :param adminUser: a user to create and modify collections and folders.
    :param collName: the collection name where the data will be added.
    :param folderName: the folder name where the data will bed aded.
    :returns: the folder where the sample data is located.
    """
    if Collection().findOne({'lowerName': collName.lower()}) is None:
        Collection().createCollection(collName, adminUser)
    collection = Collection().findOne({'lowerName': collName.lower()})
    if Folder().findOne({
            'parentId': collection['_id'], 'lowerName': folderName.lower()}) is None:
        Folder().createFolder(collection, folderName, parentType='collection',
                              public=True, creator=adminUser)
    folder = Folder().findOne({'parentId': collection['_id'], 'lowerName': folderName.lower()})

    remote = girder_client.GirderClient(apiUrl='https://data.kitware.com/api/v1')
    remoteFolder = remote.resourceLookup('/collection/HistomicsTK/Deployment test images')
    sampleItems = []
    for remoteItem in remote.listItem(remoteFolder['_id']):
        item = Item().findOne({'folderId': folder['_id'], 'name': remoteItem['name']})
        if item and len(list(Item().childFiles(item, limit=1))):
            sampleItems.append(item)
            continue
        if not item:
            item = Item().createItem(remoteItem['name'], creator=adminUser, folder=folder)
        for remoteFile in remote.listFile(remoteItem['_id']):
            with tempfile.NamedTemporaryFile() as tf:
                fileName = tf.name
                tf.close()
                sys.stdout.write('Downloading %s' % remoteFile['name'])
                sys.stdout.flush()
                remote.downloadFile(remoteFile['_id'], fileName)
                sys.stdout.write(' .')
                sys.stdout.flush()
                Upload().uploadFromFile(
                    open(fileName, 'rb'), os.path.getsize(fileName),
                    name=remoteItem['name'], parentType='item',
                    parent=item, user=adminUser)
                sys.stdout.write('.\n')
                sys.stdout.flush()
        sampleItems.append(item)
    for item in sampleItems:
        if 'largeImage' not in item:
            sys.stdout.write('Making large_item %s ' % item['name'])
            sys.stdout.flush()
            try:
                ImageItem().createImageItem(item, createJob=False)
            except Exception:
                pass
            print('done')
    return folder


def provision():
    # If there is are no users, create an admin user
    if User().findOne() is None:
        User().createUser('admin', 'password', 'Admin', 'Admin', 'admin@nowhere.nil')
    adminUser = User().findOne({'admin': True})

    # Make sure we have an assetstore
    if Assetstore().findOne() is None:
        Assetstore().createFilesystemAssetstore('Assetstore', '/assetstore')

    # Make sure we have a demo collection and download some demo files
    folder = get_sample_data(adminUser)
    # Attach an example experiment to the folder
    with open('examples/experiment.json') as fptr:
        Folder().setMetadata(folder, metadata={'experiments': json.load(fptr)})
    # Show label and macro images, plus tile and internal metadata for all users
    # Setting().set(liSettings.LARGE_IMAGE_SHOW_EXTRA_ADMIN, '{"images": ["label", "macro"]}')
    # Setting().set(liSettings.LARGE_IMAGE_SHOW_EXTRA, '{"images": ["label", "macro"]}')
    # Setting().set(liSettings.LARGE_IMAGE_SHOW_ITEM_EXTRA_ADMIN,
    #               '{"metadata": ["tile", "internal"], "images": ["label", "macro", "*"]}')
    # Setting().set(liSettings.LARGE_IMAGE_SHOW_ITEM_EXTRA,
    #               '{"metadata": ["tile", "internal"], "images": ["label", "macro", "*"]}')


if __name__ == '__main__':
    # This loads plugins, allowing setting validation
    configureServer()
    provision()
