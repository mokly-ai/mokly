FROM debian:trixie-20261123-slim@sha256:8aa5a7bf5a1955bddbe7d74fcdd0b91ab30e74362a8b73af672b0481b35b44a0
USER root

ARG NODE_VERSION=24.21.0
ARG NODE_SHA256=fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6
RUN apt-get update \
    && DEBIAN_FRONTEND=noninteractive apt-get upgrade -y \
    && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        build-essential ca-certificates coreutils curl git python3 xz-utils \
    && rm -rf /var/lib/apt/lists/* \
    && curl --fail --show-error --location --proto '=https' --tlsv1.2 \
        "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
        --output /tmp/node.tar.xz \
    && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum --check --strict \
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
