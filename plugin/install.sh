#!/bin/bash
set -euo pipefail

# Campfire-plugin installer (macOS / Linux / WSL2)
#
# Install:
#   curl -fsSL https://raw.githubusercontent.com/zhangqikevin/campfire/main/plugin/install.sh | bash
#
# Uninstall:
#   curl -fsSL https://raw.githubusercontent.com/zhangqikevin/campfire/main/plugin/install.sh | bash -s -- uninstall
#
# What this does:
#   1. Verifies prereqs (openclaw CLI, Node ≥ 22.5, pnpm).
#   2. Pulls the campfire repo (plugin/ + local-ui/) via degit.
#   3. Builds local-ui (Next.js static export) → bundles into plugin/static/.
#   4. Builds plugin (esbuild bundle).
#   5. Strips node_modules (openclaw's plugin scanner trips on pnpm symlinks).
#   6. Registers the plugin with openclaw and restarts the gateway.
#
# After install, run `openclaw campfire url` and open the printed URL —
# no separate web server, no Postgres, no Docker. The plugin serves the
# workspace UI on the gateway's own HTTP port.

export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

PREFIX="[campfire-plugin]"
REPO="zhangqikevin/campfire"
# We pull the whole repo because we need both `plugin/` and `local-ui/`;
# the latter gets statically exported and bundled into the plugin's
# static/ directory so the gateway can serve the workspace UI itself.
SRC_DIR="$HOME/.openclaw/campfire-src"
PLUGIN_DIR="$SRC_DIR/plugin"
UI_DIR="$SRC_DIR/local-ui"
PLUGIN_ID="campfire-plugin"

BOLD='\033[1m'
ACCENT='\033[38;2;234;88;12m'
INFO='\033[38;2;136;146;176m'
SUCCESS='\033[38;2;0;229;204m'
WARN='\033[38;2;255;176;32m'
ERROR='\033[38;2;230;57;70m'
NC='\033[0m'

log()  { printf "${INFO}%s${NC} %s\n" "$PREFIX" "$1"; }
ok()   { printf "${SUCCESS}%s${NC} %s\n" "$PREFIX" "$1"; }
warn() { printf "${WARN}%s WARNING:${NC} %s\n" "$PREFIX" "$1"; }
fatal(){ printf "${ERROR}%s ERROR:${NC} %s\n" "$PREFIX" "$1" >&2; exit 1; }
step() { printf "\n${BOLD}${ACCENT}==>${NC} ${BOLD}%s${NC}\n" "$1"; }

banner() {
  printf "\n${BOLD}${ACCENT}Campfire${NC} ${INFO}— plugin for OpenClaw${NC}\n\n"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fatal "$2"
}

check_prereqs() {
  step "Checking prerequisites"
  require_cmd openclaw "OpenClaw CLI not found. Install it first: https://openclaw.ai/install.sh"
  require_cmd node "Node.js not found. Install Node 22.5+ from https://nodejs.org"
  require_cmd npx "npx not found. Reinstall Node.js to get npx."

  local node_version node_major node_minor
  node_version="$(node -p 'process.versions.node')"
  node_major="$(printf '%s' "$node_version" | cut -d. -f1)"
  node_minor="$(printf '%s' "$node_version" | cut -d. -f2)"
  if [[ "$node_major" -lt 22 ]] || { [[ "$node_major" -eq 22 ]] && [[ "$node_minor" -lt 5 ]]; }; then
    fatal "Node $node_version detected. Campfire plugin requires Node 22.5+ (node:sqlite is a 22.5 built-in)."
  fi

  if ! command -v pnpm >/dev/null 2>&1; then
    log "pnpm not found, installing via corepack…"
    corepack enable >/dev/null 2>&1 || npm install -g pnpm >/dev/null 2>&1 \
      || fatal "Could not install pnpm. Install manually: npm i -g pnpm"
  fi

  ok "openclaw $(openclaw --version 2>/dev/null | head -1) · node $node_version · pnpm $(pnpm --version)"
}

download_source() {
  step "Downloading source ($REPO)"

  mkdir -p "$(dirname "$SRC_DIR")"
  if [[ -d "$SRC_DIR" ]]; then
    log "Removing previous source at $SRC_DIR"
    rm -rf "$SRC_DIR"
  fi

  npx -y degit "${REPO}" "$SRC_DIR" \
    || fatal "degit failed for $REPO. Check network and that the repo is public."

  [[ -f "$PLUGIN_DIR/openclaw.plugin.json" ]] \
    || fatal "Downloaded source missing $PLUGIN_DIR/openclaw.plugin.json. Repo layout may have changed."
  [[ -f "$UI_DIR/package.json" ]] \
    || fatal "Downloaded source missing $UI_DIR/package.json. Repo layout may have changed."

  ok "Downloaded to $SRC_DIR"
}

# --registry override defends against users whose global pnpm/npm is pinned
# to a mirror (cnpm, npmmirror, taobao, corporate proxy) that doesn't have
# the @openuidev/* renderer packages. Each subdir also ships an .npmrc with
# the same pin; passing it on the CLI too belt-and-braces against the rare
# case where the .npmrc is overridden by env/global config.
readonly NPM_REGISTRY="https://registry.npmjs.org/"

# CAMPFIRE_EXTERNAL_URL — set this when your gateway sits behind a reverse
# proxy with a path prefix, e.g.:
#
#   CAMPFIRE_EXTERNAL_URL=https://pods.favie.us/oc/pokeball \
#     curl -fsSL https://.../install.sh | bash
#
# The script extracts the URL path (e.g. `/oc/pokeball`), uses it to set
# Next.js's basePath at build time (so HTML asset URLs include the proxy
# prefix), and writes the URL to a sidecar file the plugin reads at
# startup (so `openclaw campfire url` prints a link a browser can reach).
CAMPFIRE_EXTERNAL_URL="${CAMPFIRE_EXTERNAL_URL:-}"
CAMPFIRE_BASE_PATH=""
if [[ -n "$CAMPFIRE_EXTERNAL_URL" ]]; then
  # Use node to parse — bash URL parsing is a footgun.
  url_path=$(node -e "
    try {
      const u = new URL(process.argv[1]);
      const p = u.pathname.replace(/\/+\$/, '');
      process.stdout.write(p);
    } catch (e) {
      process.stderr.write('Invalid CAMPFIRE_EXTERNAL_URL: ' + e.message);
      process.exit(1);
    }
  " "$CAMPFIRE_EXTERNAL_URL") || fatal "Failed to parse CAMPFIRE_EXTERNAL_URL ($CAMPFIRE_EXTERNAL_URL)"
  CAMPFIRE_BASE_PATH="${url_path}/plugins/campfire"
  log "Reverse-proxy mode: external URL = $CAMPFIRE_EXTERNAL_URL"
  log "                    basePath     = $CAMPFIRE_BASE_PATH"
fi

build_local_ui() {
  step "Building local-ui (Next.js static export, served by the plugin)"
  log "This compiles the workspace UI bundle. Expect ~30-60s on first run."

  ( cd "$UI_DIR" && pnpm install --no-frozen-lockfile --ignore-scripts --registry="$NPM_REGISTRY" ) \
    || fatal "local-ui pnpm install failed. See output above."

  # Pass through CAMPFIRE_BASE_PATH if we computed one — next.config.ts reads
  # it. Empty string falls back to the default `/plugins/campfire`.
  #
  # CAMPFIRE_VERSION: short SHA of the main branch we just pulled. degit
  # strips .git so next.config.ts can't compute this on its own — fetch from
  # the GitHub API. Failure is non-fatal; we just show no version.
  local version
  version=$(curl -fsSL "https://api.github.com/repos/$REPO/commits/main" 2>/dev/null \
    | sed -n 's/.*"sha": *"\([0-9a-f]\{7,40\}\)".*/\1/p' \
    | head -1 \
    | cut -c1-7) || version=""
  if [[ -n "$version" ]]; then
    log "Build version label: $version"
  fi
  ( cd "$UI_DIR" \
      && CAMPFIRE_BASE_PATH="$CAMPFIRE_BASE_PATH" \
         CAMPFIRE_VERSION="$version" \
         pnpm build ) \
    || fatal "local-ui build failed. See output above."

  [[ -d "$UI_DIR/out" ]] || fatal "local-ui build did not produce out/."

  rm -rf "$PLUGIN_DIR/static"
  cp -r "$UI_DIR/out" "$PLUGIN_DIR/static" \
    || fatal "Could not copy local-ui/out to plugin/static"

  ok "Bundled UI at $PLUGIN_DIR/static/"
}

write_external_url_sidecar() {
  # Only write the file when we actually have an external URL; if it doesn't
  # exist, the plugin falls back to its localhost-derived behavior.
  if [[ -n "$CAMPFIRE_EXTERNAL_URL" ]]; then
    step "Writing external-URL sidecar so the CLI prints the proxy URL"
    printf '%s' "$CAMPFIRE_EXTERNAL_URL" > "$PLUGIN_DIR/external-url"
    ok "Wrote $PLUGIN_DIR/external-url"
  fi
}

build_plugin() {
  step "Building plugin (pnpm install + esbuild bundle)"

  ( cd "$PLUGIN_DIR" && pnpm install --no-frozen-lockfile --ignore-scripts --registry="$NPM_REGISTRY" ) \
    || fatal "plugin pnpm install failed. See output above."

  ( cd "$PLUGIN_DIR" && pnpm build ) \
    || fatal "plugin esbuild bundle failed. See output above."

  [[ -f "$PLUGIN_DIR/dist/index.js" ]] || fatal "Build did not produce dist/index.js."

  ok "Built dist/index.js"
}

shrink_source() {
  step "Removing node_modules (pnpm symlinks trip openclaw's install scanner)"
  # Recursive — catches nested workspaces under local-ui/ as well as plugin/.
  find "$SRC_DIR" -type d -name node_modules -prune -exec rm -rf {} + 2>/dev/null || true
  ok "node_modules removed (built artifacts kept)"
}

install_plugin() {
  step "Registering plugin with OpenClaw"
  openclaw plugins install "$PLUGIN_DIR" --force \
    || fatal "openclaw plugins install failed. Run with --verbose for detail."
  ok "Plugin installed"
}

restart_gateway() {
  step "Restarting OpenClaw gateway"
  if openclaw gateway restart 2>&1; then
    ok "Gateway restarted"
  else
    warn "Could not restart gateway automatically. Run: openclaw gateway restart"
  fi
}

verify() {
  step "Verifying installation"
  local found=""
  if command -v jq >/dev/null 2>&1; then
    found=$(openclaw plugins list --json 2>/dev/null \
      | jq -r --arg id "$PLUGIN_ID" '.. | select(.id? == $id) | "\(.id) status=\(.status) enabled=\(.enabled)"' \
      | head -1)
  else
    found=$(openclaw plugins list --json 2>/dev/null | tr -d '\n ' | grep -o "\"id\":\"$PLUGIN_ID\"" | head -1)
  fi

  if [[ -n "$found" ]]; then
    ok "$PLUGIN_ID registered ($found)"
  else
    fatal "$PLUGIN_ID not visible in 'openclaw plugins list --json'. Run: openclaw plugins list --json | grep $PLUGIN_ID"
  fi
}

uninstall_plugin() {
  step "Disabling $PLUGIN_ID"
  if openclaw plugins disable "$PLUGIN_ID" 2>&1; then
    ok "Plugin disabled"
  else
    warn "Could not disable plugin (may not be installed). Continuing."
  fi

  step "Uninstalling $PLUGIN_ID"
  if openclaw plugins uninstall "$PLUGIN_ID" --force 2>&1; then
    ok "Plugin uninstalled"
  else
    warn "Could not uninstall plugin (may not be registered). Continuing."
  fi
}

remove_source() {
  step "Removing source at $SRC_DIR"
  if [[ -d "$SRC_DIR" ]]; then
    rm -rf "$SRC_DIR"
    ok "Removed $SRC_DIR"
  else
    log "Source dir not present, skipping"
  fi
}

print_next_steps() {
  printf "\n  ${BOLD}Open the workspace:${NC}\n"
  printf "    ${INFO}openclaw campfire url${NC}\n\n"
  printf "  That prints a URL like ${BOLD}http://localhost:18789/plugins/campfire/setup/#token=…${NC}\n"
  printf "  Open it in a browser; the token gets saved locally and you land in chat.\n\n"
}

do_install() {
  banner
  check_prereqs
  download_source
  build_local_ui
  build_plugin
  write_external_url_sidecar
  shrink_source
  install_plugin
  restart_gateway
  verify

  printf "\n${SUCCESS}${BOLD}✓ campfire-plugin installed.${NC}\n"
  print_next_steps
}

do_uninstall() {
  banner
  require_cmd openclaw "OpenClaw CLI not found — nothing to uninstall."
  uninstall_plugin
  remove_source
  restart_gateway

  printf "\n${SUCCESS}${BOLD}✓ campfire-plugin uninstalled.${NC}\n\n"
}

main() {
  case "${1:-install}" in
    install)   do_install ;;
    uninstall) do_uninstall ;;
    *) fatal "Unknown command: $1. Use 'install' (default) or 'uninstall'." ;;
  esac
}

main "$@"
