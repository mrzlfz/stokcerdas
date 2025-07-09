# =======================================
# StokCerdas AI - Comprehensive Dockerfile
# Supports Node.js + Python ML Environment
# Multi-stage build: development, production
# =======================================

# --------------------------------------
# Stage 1: Base Image with Node.js + Python
# --------------------------------------
FROM node:22-bullseye AS base

# Set working directory
WORKDIR /app

# Install system dependencies for Python and ML libraries
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    build-essential \
    curl \
    ca-certificates \
    gnupg \
    lsb-release \
    # Scientific computing dependencies
    libopenblas-dev \
    liblapack-dev \
    gfortran \
    # Prophet dependencies
    libffi-dev \
    libssl-dev \
    # Image processing dependencies
    libjpeg-dev \
    libpng-dev \
    # Cleanup
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create Python virtual environment
ENV VIRTUAL_ENV=/app/venv
RUN python3 -m venv $VIRTUAL_ENV
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Upgrade pip and install wheel
RUN pip install --upgrade pip setuptools wheel

# --------------------------------------
# Stage 2: Dependencies Installation
# --------------------------------------
FROM base AS dependencies

# Copy Python requirements first (for better caching)
COPY requirements.txt ./

# Install Python ML dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy package files for Node.js dependencies
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production && npm cache clean --force

# --------------------------------------
# Stage 3: Development Build
# --------------------------------------
FROM dependencies AS development

# Install development dependencies
RUN npm ci && npm cache clean --force

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p dist logs uploads temp

# Set permissions for Python scripts
RUN chmod +x src/ml-forecasting/python/*.py

# Expose ports
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Development command
CMD ["npm", "run", "dev"]

# --------------------------------------
# Stage 4: Build Stage
# --------------------------------------
FROM development AS builder

# Build TypeScript application
RUN npm run build

# Remove development dependencies
RUN npm ci --only=production && npm cache clean --force

# --------------------------------------
# Stage 5: Production Image
# --------------------------------------
FROM base AS production

# Copy Python dependencies from dependencies stage
COPY --from=dependencies $VIRTUAL_ENV $VIRTUAL_ENV

# Copy production Node.js dependencies
COPY --from=builder /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy Python ML scripts with proper permissions
COPY --from=builder /app/src/ml-forecasting/python ./src/ml-forecasting/python
RUN chmod +x src/ml-forecasting/python/*.py

# Copy configuration files
COPY --from=builder /app/package*.json ./

# Create application user for security
RUN groupadd -r stokcerdas && useradd -r -g stokcerdas stokcerdas

# Create necessary directories and set permissions
RUN mkdir -p logs uploads temp \
    && chown -R stokcerdas:stokcerdas /app \
    && chmod -R 755 /app

# Switch to non-root user
USER stokcerdas

# Environment variables
ENV NODE_ENV=production
ENV PYTHON_PATH=/app/src/ml-forecasting/python
ENV VIRTUAL_ENV=/app/venv
ENV PATH="$VIRTUAL_ENV/bin:$PATH"

# Expose port
EXPOSE 3000

# Health check for production
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Production startup command
CMD ["npm", "run", "start:prod"]

# --------------------------------------
# Stage 6: Testing Stage (Optional)
# --------------------------------------
FROM development AS testing

# Install testing dependencies
RUN npm install

# Copy test files
COPY test ./test

# Run tests
RUN npm run test && npm run test:e2e

# --------------------------------------
# Metadata and Labels
# --------------------------------------
LABEL maintainer="StokCerdas Team"
LABEL version="1.0.0"
LABEL description="StokCerdas AI-Powered Inventory Intelligence Platform"
LABEL org.opencontainers.image.title="StokCerdas Backend"
LABEL org.opencontainers.image.description="Node.js + Python ML Backend for Indonesian SMB Inventory Management"
LABEL org.opencontainers.image.vendor="StokCerdas"
LABEL org.opencontainers.image.source="https://github.com/stokcerdas/backend"

# Build arguments for versioning
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

LABEL org.opencontainers.image.created=$BUILD_DATE
LABEL org.opencontainers.image.revision=$VCS_REF
LABEL org.opencontainers.image.version=$VERSION

# Indonesian SMB optimization metadata
LABEL stokcerdas.optimization.target="Indonesian SMB"
LABEL stokcerdas.ml.models="ARIMA,Prophet,XGBoost"
LABEL stokcerdas.python.version="3.13.3"
LABEL stokcerdas.node.version="22.17.0"