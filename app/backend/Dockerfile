# syntax=docker/dockerfile:1.7
ARG RUST_VERSION=1.83
ARG APP_NAME=helmer-api

FROM rust:${RUST_VERSION}-bookworm AS chef
WORKDIR /app
RUN cargo install cargo-chef --version 0.1.62
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

FROM rust:${RUST_VERSION}-bookworm AS builder
WORKDIR /app
RUN cargo install cargo-chef
COPY --from=chef /app/recipe.json recipe.json

# Build des dépendances (caché si Cargo.* inchangés)
RUN cargo chef cook --release --recipe-path recipe.json

# Build de l'application
COPY . .
ENV CARGO_TERM_COLOR=never
RUN cargo build --release --bin helmer-api && \
    strip /app/target/release/helmer-api

FROM debian:bookworm-slim
ARG APP_NAME=helmer-api
ARG APP_UID=1000
WORKDIR /app

# Dépendances runtime
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    skopeo \
    ca-certificates && \
    rm -rf /var/lib/apt/lists/*

# Utilisateur non-root système (sans shell)
RUN useradd -r -u ${APP_UID} -g users -d /nonexistent -s /usr/sbin/nologin helmer

# Binaire
COPY --from=builder /app/target/release/helmer-api /usr/local/bin/helmer-api

USER ${APP_UID}
ENV RUST_LOG=info \
    PORT=8080 \
    SKOPEO_PATH=/usr/bin/skopeo
EXPOSE 8080

CMD ["/usr/local/bin/helmer-api"]
