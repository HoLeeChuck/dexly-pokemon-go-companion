#!/bin/bash
# Run all five projects from a tracked-source archive in a fresh Linux directory.
set -euo pipefail
archive=${1:?Usage: verify-linux-browser.sh SOURCE_TAR [PORT]}
port=${2:-5398}
nodebin=${CATCHGRID_NODE_BIN:-/root/catchgrid-f1/runtime/node-v24.19.0-linux-x64/bin}
test -x "$nodebin/node"
test -x "$nodebin/corepack"
test -f "$archive"
taskroot=$(mktemp -d /tmp/catchgrid-browser-XXXXXX)
mkdir "$taskroot/repo" "$taskroot/bin"
printf '#!/bin/sh\nexec corepack pnpm "$@"\n' > "$taskroot/bin/pnpm"
chmod +x "$taskroot/bin/pnpm"
export PATH="$taskroot/bin:$nodebin:/usr/bin:/bin"
tar -xf "$archive" -C "$taskroot/repo"
cd "$taskroot/repo"
printf 'Evidence directory: %s\n' "$taskroot"
node --version
pnpm --version
pnpm install --frozen-lockfile --offline 2>&1 | tee "$taskroot/install.log"
PORT="$port" node -e 'const net=require("net");const s=net.createServer();s.on("error",()=>process.exit(1));s.listen(Number(process.env.PORT),"127.0.0.1",()=>s.close());'
CI=1 PLAYWRIGHT_PORT="$port" pnpm run test:e2e 2>&1 | tee "$taskroot/browser.log"
