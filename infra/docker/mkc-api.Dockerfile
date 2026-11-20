ARG RUST_VERSION=1.98.1
FROM rust:${RUST_VERSION}-bookworm AS build
ARG RUST_VERSION
ARG MKC_BUILD_SHA
WORKDIR /build
RUN apt-get update && apt-get install -y --no-install-recommends libpq-dev && rm -rf /var/lib/apt/lists/*
COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates ./crates
COPY xtask ./xtask
RUN test "$(sed -n 's/^channel = "\([^"]*\)"/\1/p' rust-toolchain.toml)" = "$RUST_VERSION"
RUN test -n "$MKC_BUILD_SHA" && MKC_BUILD_SHA="$MKC_BUILD_SHA" cargo build --locked --release -p mkc-api -p mkc-catalogue-server

FROM debian:bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libpq5 && rm -rf /var/lib/apt/lists/*
COPY --from=build /build/target/release/mkc-api /usr/local/bin/mkc-api
COPY --chmod=755 infra/docker/entrypoint.sh /usr/local/bin/mkc-entrypoint
USER 65532:65532
ENV MKC_BIND=0.0.0.0:8080
EXPOSE 8080
STOPSIGNAL SIGINT
ENTRYPOINT ["/usr/local/bin/mkc-entrypoint"]
CMD ["serve"]
