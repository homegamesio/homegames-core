#!/bin/bash
# Uses the same isolated, content-addressed runtime context as the app.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec node "$SCRIPT_DIR/prepare-context.js"
