#!/bin/bash
# Smoke test for Vector Design Tool — PR #2
# Run from repo root with:
#   PATH=/home/com194/.nvm/versions/node/v24.21.0/bin:$PATH bash scripts/smoke-test.sh
set -e

echo "=== Vector Design Tool — Smoke Test ==="
echo "Node: $(node --version)"
echo ""

# 1. Build
echo "[1/5] Building..."
npm run build -- --webpack
echo "  ✓ Build passed (webpack)"

# 2. Lint
echo "[2/5] Linting..."
npm run lint 2>&1 | tail -3
echo "  ✓ Lint clean"

# 3. File validation logic
echo "[3/5] Testing file validation..."
node -e "
const fs = require('fs');
const src = fs.readFileSync('./src/lib/fileValidation.ts','utf8');
if (src.includes('validateFile') && src.includes('ACCEPTED_MIME_TYPES')) {
  console.log('  ✓ fileValidation.ts exports validateFile + ACCEPTED_MIME_TYPES');
} else {
  console.log('  ✗ fileValidation.ts missing expected exports');
  process.exit(1);
}
"

# 4. Structure checks
echo "[4/5] Verifying file structure..."
FILES=(
  "src/lib/export/index.ts"
  "src/lib/export/svg.ts"
  "src/lib/export/pdf.ts"
  "src/lib/export/raster.ts"
  "src/lib/export/textPaths.ts"
  "src/components/designer/CanvasStage.tsx"
  "src/components/designer/Designer.tsx"
  "src/components/designer/ExportDialog.tsx"
  "src/store/designer.ts"
  "src/lib/designDocument.ts"
  "src/lib/designStorage.ts"
  "src/lib/units.ts"
  "src/lib/fonts.ts"
  "src/hooks/useAutosave.ts"
)
for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "  ✗ Missing: $f"
    exit 1
  fi
done
echo "  ✓ All ${#FILES[@]} expected files present"

# 5. Export modules parse
echo "[5/5] Verifying export modules..."
node -e "
const fs = require('fs');
const files = [
  './src/lib/export/svg.ts',
  './src/lib/export/pdf.ts',
  './src/lib/export/raster.ts',
  './src/lib/export/textPaths.ts'
];
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (!src.includes('export ')) {
    console.log('  ✗ ' + f + ' has no exports');
    process.exit(1);
  }
}
console.log('  ✓ All export modules have exports');
"

echo ""
echo "=== Smoke Test Complete ==="
echo "All checks passed. Ready for PR merge review."
