#!/usr/bin/env bash
set -euo pipefail

config="${OPENCODE_CONFIG_FILE:-$HOME/.config/opencode/opencode.json}"

if grep -q '/Cellar/engram/' "$config" "$HOME/.config/opencode/plugins/engram.ts"; then
  printf 'Engram MCP check failed: versioned Homebrew Cellar path found. Use /opt/homebrew/opt/engram/bin/engram instead.\n' >&2
  exit 1
fi

if [ ! -x /opt/homebrew/opt/engram/bin/engram ]; then
  printf 'Engram MCP check failed: /opt/homebrew/opt/engram/bin/engram is not executable.\n' >&2
  exit 1
fi

/opt/homebrew/opt/engram/bin/engram mcp --tools=agent --help >/dev/null
printf 'Engram MCP check passed.\n'
