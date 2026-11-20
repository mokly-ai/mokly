ARG NODE_VERSION=24.21.0
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /build
# The app installs from the root npm workspace and imports the workspace
# @mokly/viewer, so the image copies every workspace manifest and source and
# builds the TypeScript Mokly packages that the viewer needs. The Rust native
# target is not needed by the web export.
COPY package.json package-lock.json tsconfig.json ./
COPY packages ./packages
COPY apps ./apps
COPY docs/mockups/styles ./docs/mockups/styles
COPY infra/docker/app-build-config.mjs ./infra/docker/app-build-config.mjs
RUN npm install --global npm@11.21.0 && ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
RUN npm run -s build --workspace @mokly/ui \
    && npm run -s build --workspace @mokly/model \
    && npm run -s build --workspace @mokly/frame \
    && npm run -s build --workspace @mokly/viewer
ARG EXPO_PUBLIC_MKC_API_ORIGIN
ARG EXPO_PUBLIC_MKC_APP_ORIGIN
ARG MKC_CATALOGUE_BASE_DOMAIN
ARG MKC_BUILD_SHA
ENV EXPO_PUBLIC_MKC_API_ORIGIN=$EXPO_PUBLIC_MKC_API_ORIGIN \
    EXPO_PUBLIC_MKC_APP_ORIGIN=$EXPO_PUBLIC_MKC_APP_ORIGIN \
    MKC_CATALOGUE_BASE_DOMAIN=$MKC_CATALOGUE_BASE_DOMAIN
RUN node infra/docker/app-build-config.mjs > /build/build-config.json
RUN npm run build:web --workspace @mokly-cloud/app

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
WORKDIR /app
COPY --from=build /build/apps/app/dist ./dist
COPY --from=build /build/build-config.json ./build-config.json
COPY infra/docker/app-server.mjs ./app-server.mjs
USER 65532:65532
ENV PORT=8080
EXPOSE 8080
STOPSIGNAL SIGINT
ENTRYPOINT ["node", "/app/app-server.mjs"]
