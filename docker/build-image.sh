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
# Prefer sibling repo; fall back to node_modules copy
if [ -d "$CORE_DIR/../homegames-common" ] && [ -f "$CORE_DIR/../homegames-common/package.json" ]; then
    COMMON_SRC="$CORE_DIR/../homegames-common"
elif [ -d "$CORE_DIR/node_modules/homegames-common" ]; then
    COMMON_SRC="$CORE_DIR/node_modules/homegames-common"
else
    echo "ERROR: Cannot find homegames-common (tried sibling dir and node_modules)" >&2
    exit 1
fi

for f in "$COMMON_SRC"/*.js "$COMMON_SRC"/package.json "$COMMON_SRC"/package-lock.json; do
    [ -f "$f" ] && cp "$f" build-deps/homegames-common/
done

# The common runtime consumes Homepad's pure input mapper. Include the same
# sibling library used by the browser while these packages are developed locally.
HOMEPAD_SRC="$COMMON_SRC/../homepad"
if [ ! -f "$HOMEPAD_SRC/package.json" ]; then
    HOMEPAD_SRC="$COMMON_SRC/node_modules/homepad"
fi
mkdir -p build-deps/homepad
cp "$HOMEPAD_SRC"/*.js "$HOMEPAD_SRC/package.json" build-deps/homepad/
cp -r "$HOMEPAD_SRC/gamepad-mappings" build-deps/homepad/

# Copy homegames-core src/ directory (GameSession, HomegamesRoot, socketServer, etc.)
# child_game_server.js lives inside src/ and uses relative requires.
cp -r "$CORE_DIR/src" build-deps/homegames-core-src

echo "Building homegames-runner image..."
docker build -t homegames-runner .

# Clean up build-deps
rm -rf build-deps

echo "Done. Image: homegames-runner"
