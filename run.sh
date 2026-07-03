#!/bin/sh
command -v node >/dev/null 2>&1 || { echo "node is not installed" >&2; exit 2; }
command -v typed-claude-hooks >/dev/null 2>&1 || { echo "typed-claude-hooks is not installed. Run: npm install -D typed-claude-hooks" >&2; exit 2; }
typed-claude-hooks run "$@"
