FROM ubuntu:18.04
LABEL maintainer="Kitware, Inc. <kitware@kitware.com>"

# See logs faster; don't write pyc or pyo files
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -qy tzdata && \
    apt-get install --no-install-recommends --yes \
    software-properties-common \
    gpg-agent \
    fonts-dejavu \
    libmagic-dev \
    git \
    libldap2-dev \
    libsasl2-dev \
    curl \
    ca-certificates \
    fuse \
    vim && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN curl -LJ https://github.com/krallin/tini/releases/download/v0.19.0/tini -o /usr/bin/tini && \
    chmod +x /usr/bin/tini

RUN add-apt-repository ppa:deadsnakes/ppa && \
    apt-get update && \
    apt-get install --no-install-recommends --yes \
    python3.9 \
    python3.9-distutils && \
    curl --silent https://bootstrap.pypa.io/get-pip.py -O && \
    python3.9 get-pip.py && \
    rm get-pip.py && \
    rm /usr/bin/python3 && \
    ln -s /usr/bin/python3.9 /usr/bin/python3 && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

RUN curl -sL https://deb.nodesource.com/setup_12.x | bash && \
    apt-get update && \
    apt-get install --no-install-recommends --yes \
    nodejs && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# add a directory for girder mount
RUN mkdir -p /fuse --mode=a+rwx

RUN mkdir -p annotation-tracker && \
    mkdir -p /conf

WORKDIR annotation-tracker

COPY . .

# By using --no-cache-dir the Docker image is smaller
RUN python3.9 -m pip install --pre --no-cache-dir \
    # git+https://github.com/arclamp/annotation-tracker.git \
    . \
    # girder[mount] adds dependencies to show tiles from S3 assets \
    girder[mount] \
    # Add additional girder plugins here \
    # girder-homepage \
    # We use girder_client for provisioning \
    girder_client \
    # Use prebuilt wheels whenever possible \
    --find-links https://girder.github.io/large_image_wheels

# Build the girder web client
RUN girder build && \
    # Git rid of unnecessary files to keep the docker image smaller \
    find /usr/local/lib/python3.9 -name node_modules -exec rm -rf {} \+ && \
    rm -rf /tmp/npm*

COPY ./devops/annotation_tracker/girder.local.conf ./devops/annotation_tracker/provision.py ./devops/annotation_tracker/init_girder.sh ./devops/annotation_tracker/init_girder_dev.sh   /conf/
RUN chmod +x /conf/init_girder.sh

ENTRYPOINT ["/conf/init_girder.sh"]
