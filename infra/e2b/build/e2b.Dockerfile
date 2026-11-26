FROM e2bdev/base:latest@sha256:4a369f01a820fe5e65f53c2c5727a78899daf86f0541b721097f289559c8b73f
USER root

ARG NODE_VERSION=24.21.0
ARG NODE_SHA256=fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6
ARG GIT_VERSION=2.56.1
ARG GIT_SHA256=f0b0bf89264b9bd2e1c640363e7529643989da76281600473c50745cd34a607f
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates coreutils curl git python3 xz-utils \
    && apt-get install -y --no-install-recommends \
        gcc libc6-dev make libcurl4-openssl-dev libexpat1-dev zlib1g-dev \
        libcurl4 libexpat1 zlib1g \
    && curl --fail --show-error --location --proto '=https' --tlsv1.2 \
        "https://mirrors.edge.kernel.org/pub/software/scm/git/git-${GIT_VERSION}.tar.xz" \
        --output /tmp/git.tar.xz \
    && echo "${GIT_SHA256}  /tmp/git.tar.xz" | sha256sum --check --strict \
    && mkdir /tmp/git-src \
    && tar --extract --xz --file /tmp/git.tar.xz --directory /tmp/git-src --strip-components=1 \
    && make -C /tmp/git-src -j"$(nproc)" prefix=/usr/local \
        NO_TCLTK=1 NO_GETTEXT=1 NO_PERL=1 NO_PYTHON=1 NO_RUST=1 install \
    && rm -rf /tmp/git.tar.xz /tmp/git-src \
    && apt-get purge -y --auto-remove \
        gcc libc6-dev make libcurl4-openssl-dev libexpat1-dev zlib1g-dev \
    && /usr/local/bin/git --version \
    && rm -rf /var/lib/apt/lists/* \
    && curl --fail --show-error --location --proto '=https' --tlsv1.2 \
        "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
        --output /tmp/node.tar.xz \
    && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum --check --strict \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /usr/local/bin/node /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /usr/local/include/node \
    && tar --extract --xz --file /tmp/node.tar.xz --directory /usr/local --strip-components=1 \
    && rm /tmp/node.tar.xz \
    && /usr/local/bin/corepack enable \
    && (id user >/dev/null 2>&1 || useradd --create-home --shell /bin/bash user) \
    && mkdir -p /workspace /home/user \
    && chown user:user /workspace /home/user \
    && rm -rf /root/.aws /root/.config/gcloud /root/.docker /root/.ssh \
        /root/.git-credentials /root/.mokly-git-credentials /root/.netrc /root/.npmrc \
        /home/user/.aws /home/user/.config/gcloud /home/user/.docker /home/user/.ssh \
        /home/user/.git-credentials /home/user/.mokly-git-credentials /home/user/.netrc /home/user/.npmrc \
    && test ! -e /home/user/.mokly-git-credentials

ENV HOME=/home/user
WORKDIR /workspace
USER user
