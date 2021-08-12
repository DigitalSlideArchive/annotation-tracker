#!/bin/sh
cd /annotation-tracker
pip install -e .
python3.9 /conf/provision.py && (girder mount /fuse || true)
exec /usr/bin/tini -v -- girder serve --dev