FROM dsarchive/dsa_common

RUN mkdir -p annotation-tracker

WORKDIR annotation-tracker

COPY . .

# By using --no-cache-dir the Docker image is smaller
RUN python3.9 -m pip install --pre --no-cache-dir \
    # git+https://github.com/arclamp/annotation-tracker.git \
    .

# Build the girder web client
RUN girder build && \
    # Git rid of unnecessary files to keep the docker image smaller \
    find /opt/venv/lib/python3.9 -name node_modules -exec rm -rf {} \+ && \
    rm -rf /tmp/npm*
