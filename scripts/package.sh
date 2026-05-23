#!/usr/bin/env bash
# Build the Figma and Penpot plugins and package each into a distributable .zip.
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
# Exclude build/preview.js (local dev preview host) and build/penpot/ (shipped
# as its own zip below) — neither belongs in the Figma plugin bundle.
zip -rq "${OUT_DIR}/${ZIP_NAME}" manifest.json build README.md LICENSE \
  -x "build/preview.js" "build/penpot/*"
cp "${OUT_DIR}/${ZIP_NAME}" "${OUT_DIR}/swift-loop-latest.zip"

# Penpot (experimental): assemble build/penpot/ and zip it at its root so the
# unzipped folder loads directly via Penpot's "load manifest URL" flow.
PENPOT_ZIP="swift-loop-penpot-v${VERSION}.zip"
echo "→ Building Penpot plugin..."
node scripts/build-penpot.mjs
echo "→ Packaging into ${OUT_DIR}/${PENPOT_ZIP}..."
rm -f "${OUT_DIR}/${PENPOT_ZIP}" "${OUT_DIR}/swift-loop-penpot-latest.zip"
( cd build/penpot && zip -rq "../../${OUT_DIR}/${PENPOT_ZIP}" . )
cp "${OUT_DIR}/${PENPOT_ZIP}" "${OUT_DIR}/swift-loop-penpot-latest.zip"

echo
echo "→ Contents:"
unzip -l "${OUT_DIR}/${ZIP_NAME}"
echo
echo "✓ Done: ${OUT_DIR}/${ZIP_NAME}"
echo "✓ Done: ${OUT_DIR}/swift-loop-latest.zip"
echo "✓ Done: ${OUT_DIR}/${PENPOT_ZIP}"
echo "✓ Done: ${OUT_DIR}/swift-loop-penpot-latest.zip"
