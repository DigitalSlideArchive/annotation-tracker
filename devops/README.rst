=========================
Deploy via Docker Compose
=========================

This directory contains a docker-compose set up for the project.

Database files and local assertsore files are persistently stored in docker volumes.  You may want to extend the docker-compose.yml file to mount external file system directories for easier import and export.

Prerequsities:
--------------

Before using this, you need both Docker and docker-compose.  See the `official installation instructions <https://docs.docker.com/compose/install>`_.

Start
-----

To start the program, in the ``devops/annotation_tracker`` directory, type::

    DSA_USER=${id -u):$(id -g) docker-compose up

By default, it creates an ``admin`` user with a password of ``password``.  Some sample files will be downloaded in the ``Sample Images`` collection.
