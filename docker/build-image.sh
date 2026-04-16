#!/bin/bash
#
# Build the homegames-runner Docker image.
#
# Copies homegames-common and homegames-core source into the build context,
# then builds the image.
#
# Usage:
#   cd homegames-core/docker
#   ./build-image.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CORE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$SCRIPT_DIR"

# Clean previous build context
rm -rf build-deps
mkdir -p build-deps/homegames-common

# Copy homegames-common source files (no .git, no node_modules)
for f in "$CORE_DIR"/../homegames-common/*.js "$CORE_DIR"/../homegames-common/package.json "$CORE_DIR"/../homegames-common/package-lock.json; do
    [ -f "$f" ] && cp "$f" build-deps/homegames-common/
done

# Copy homegames-core src/ directory (GameSession, HomegamesRoot, socketServer, etc.)
# child_game_server.js lives inside src/ and uses relative requires.
cp -r "$CORE_DIR/src" build-deps/homegames-core-src

# Remove squish-137 from squish-map.js (it's a local file: dep, never published to npm)
# The Docker image only has published squish versions.
if [ -f build-deps/homegames-core-src/common/squish-map.js ]; then
    sed -i.bak "/'137'/d" build-deps/homegames-core-src/common/squish-map.js
    rm -f build-deps/homegames-core-src/common/squish-map.js.bak
fi

echo "Building homegames-runner image..."
docker build -t homegames-runner .

# Clean up build-deps
rm -rf build-deps

echo "Done. Image: homegames-runner"
