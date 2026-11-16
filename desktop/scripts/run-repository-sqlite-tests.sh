#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js is required.' >&2; exit 1
fi
node -e 'const n=Number(process.versions.node.split(".")[0]); if(n<22){console.error("Node.js 22+ required for node:sqlite tests");process.exit(1)}'
if [ ! -f src/data/repositories/productRepository.core.ts ]; then
  echo 'Missing src/data/repositories/productRepository.core.ts' >&2; exit 1
fi
if [ ! -f src-tauri/migrations/001_initial_catalog.sql ]; then
  echo 'Missing src-tauri/migrations/001_initial_catalog.sql' >&2; exit 1
fi
mkdir -p tests/.compiled
printf '{"type":"commonjs"}\n' > tests/.compiled/package.json
npx --no-install tsc --strict --target ES2022 --module commonjs \
  --lib ES2022,DOM --rootDir src --outDir tests/.compiled \
  src/data/repositories/productRepository.core.ts
node --test tests/productRepository.sqlite.test.cjs
