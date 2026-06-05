#!/usr/bin/env bash
# Build the Figma plugin and package it into a distributable .zip.
# Mirrors what .github/workflows/release.yml does on tag pushes, so you can
# verify the artifacts locally before cutting a release.
set -euo pipefail

cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
OUT_DIR="dist"
ZIP_NAME="swift-loop-v${VERSION}.zip"

echo "→ Building plugin (v${VERSION})..."
bun run build

if [ ! -f build/main.js ] || [ ! -f build/ui.js ]; then
  echo "✗ build/main.js or build/ui.js missing after build — aborting." >&2
  exit 1
fi

echo "→ Packaging into ${OUT_DIR}/${ZIP_NAME}..."
mkdir -p "${OUT_DIR}"
rm -f "${OUT_DIR}/${ZIP_NAME}" "${OUT_DIR}/swift-loop-latest.zip"
# Exclude build/preview.js (local dev preview host) — it doesn't belong in the
# Figma plugin bundle.
zip -rq "${OUT_DIR}/${ZIP_NAME}" manifest.json build README.md LICENSE \
  -x "build/preview.js"
cp "${OUT_DIR}/${ZIP_NAME}" "${OUT_DIR}/swift-loop-latest.zip"

echo
echo "→ Contents:"
unzip -l "${OUT_DIR}/${ZIP_NAME}"
echo
echo "✓ Done: ${OUT_DIR}/${ZIP_NAME}"
echo "✓ Done: ${OUT_DIR}/swift-loop-latest.zip"
