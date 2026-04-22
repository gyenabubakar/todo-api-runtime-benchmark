# Build stage
FROM swift:6.2.3-noble AS builder

WORKDIR /app

# Copy package files first for better caching
COPY Package.swift Package.resolved* ./

# Resolve dependencies
RUN swift package resolve

# Copy source code
COPY Sources Sources
COPY Tests Tests

# Build release binary
RUN swift build -c release --static-swift-stdlib

# Runtime stage
FROM ubuntu:noble

# Install required runtime libraries
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

RUN apt-get update -o Acquire::Retries=5 && apt-get install -y --fix-missing \
    libcurl4 \
    libxml2 \
    ca-certificates \
    tzdata \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd --user-group --create-home --system --skel /dev/null --home-dir /app hummingbird

WORKDIR /app

# Copy binary from builder
COPY --from=builder /app/.build/release/App /app/App

# Set ownership
RUN chown -R hummingbird:hummingbird /app

USER hummingbird

EXPOSE 8080

ENTRYPOINT ["/app/App"]
CMD ["--hostname", "0.0.0.0", "--port", "8080"]
