#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p tests/build
npx --no-install tsc --strict --target ES2022 --module commonjs \
  --lib ES2022,DOM --rootDir src --outDir tests/build \
  src/data/repositories/inventoryRepository.shared.ts \
  src/data/repositories/branchRepository.core.ts \
  src/data/repositories/locationRepository.core.ts \
  src/data/repositories/productUnitRepository.core.ts \
  src/features/products/utils/unitConversion.ts
  printf '%s\n' '{"type":"commonjs"}' > tests/build/package.json
node --test tests/week5-repositories.sqlite.test.cjs
