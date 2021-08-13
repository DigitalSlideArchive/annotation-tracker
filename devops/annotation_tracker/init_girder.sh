#!/bin/sh
cd /annotation-tracker
python3.9 /conf/provision.py && (girder mount /fuse || true)
exec /usr/bin/tini -v -- girder serve
