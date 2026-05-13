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
#   1. Verifies prereqs (openclaw CLI ≥ 2026.4.12, Node ≥ 22.5 for node:sqlite, pnpm).
#   2. Pulls just the plugin/ subdirectory from github.com/zhangqikevin/campfire.
#   3. Builds the esbuild bundle.
#   4. Removes node_modules (openclaw's plugin scanner trips on pnpm symlinks).
#   5. Registers the plugin with openclaw and restarts the gateway.
#   6. Verifies the plugin shows up as enabled.
#
# Compared to openclaw-os's install.sh, this script DOES NOT:
#   - Modify tools.alsoAllow in your openclaw.json (silent permission expansion).
#   - Open a browser window. The Campfire UI lives at the Campfire web app,
#     not on your gateway, so there's no local URL to land on.

# Suppress corepack's interactive download prompt — there is no TTY in `curl | bash`.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0

PREFIX="[campfire-plugin]"
REPO="zhangqikevin/campfire"
SRC_SUBPATH="plugin"
SRC_DIR="$HOME/.openclaw/campfire-plugin"
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

  # The plugin uses node:sqlite — a Node 22.5+ built-in. Anything older blows
  # up at plugin load time with "Cannot find module 'node:sqlite'". Catch it
  # here so the user knows what to fix.
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
  step "Downloading plugin source ($REPO/$SRC_SUBPATH)"

  mkdir -p "$(dirname "$SRC_DIR")"
  if [[ -d "$SRC_DIR" ]]; then
    log "Removing previous source at $SRC_DIR"
    rm -rf "$SRC_DIR"
  fi

  npx -y degit "${REPO}/${SRC_SUBPATH}" "$SRC_DIR" \
    || fatal "degit failed for $REPO/$SRC_SUBPATH. Check network and that the repo is public."

  [[ -f "$SRC_DIR/openclaw.plugin.json" ]] \
    || fatal "Downloaded source is missing openclaw.plugin.json. Repo layout may have changed."

  ok "Downloaded to $SRC_DIR"
}

build_plugin() {
  step "Building plugin (pnpm install + esbuild bundle)"

  # --no-frozen-lockfile so a future drift in the lockfile doesn't break the
  # one-liner install. CI builds the plugin with the frozen lockfile, so the
  # version we publish via git is reproducible; this is just defensive.
  ( cd "$SRC_DIR" && pnpm install --no-frozen-lockfile --silent ) \
    || fatal "pnpm install failed. See output above."

  ( cd "$SRC_DIR" && pnpm build ) \
    || fatal "esbuild bundle failed. See output above."

  [[ -f "$SRC_DIR/dist/index.js" ]] || fatal "Build did not produce dist/index.js."

  ok "Built dist/index.js"
}

shrink_source() {
  step "Removing node_modules (pnpm symlinks trip openclaw's install scanner)"
  rm -rf "$SRC_DIR/node_modules" 2>/dev/null || true
  ok "node_modules removed (bundled dist/ retained)"
}

install_plugin() {
  step "Registering plugin with OpenClaw"
  openclaw plugins install "$SRC_DIR" --force \
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
  printf "\n  ${BOLD}Next:${NC} grab your gateway token —\n"
  printf "    ${INFO}cat ~/.openclaw/openclaw.json | jq -r .gateway.auth.token${NC}\n\n"
  printf "  Open Campfire (http://localhost:3000 if running locally) →\n"
  printf "  Bind an agent → URL = ${BOLD}ws://localhost:18789${NC} + paste the token.\n\n"
}

do_install() {
  banner
  check_prereqs
  download_source
  build_plugin
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
