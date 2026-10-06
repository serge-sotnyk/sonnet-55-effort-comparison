#!/usr/bin/env bash
# Runs one Codex build of the original or Special prompt in a fresh, empty folder.
# Usage: scripts/run-codex.sh <model> <effort> [original|special]
#        e.g. gpt-6.1-sol high          gpt-6-astra low special
set -euo pipefail

MODEL="${1:?usage: run-codex.sh <model> <effort>}"
EFFORT="${2:?usage: run-codex.sh <model> <effort>}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORK_ROOT="${WORK_ROOT:-$HOME/codex-experiment}"
PROMPT="${3:-original}"
case "$PROMPT" in
  original) RUN_ID="codex-${MODEL}-${EFFORT}"; PROMPT_FILE="$REPO/prompts/original.txt" ;;
  special) RUN_ID="codex-${MODEL}-special-${EFFORT}"; PROMPT_FILE="$REPO/prompts/special-build.txt" ;;
  *) echo "unknown prompt: $PROMPT" >&2; exit 2 ;;
esac

WORK="$WORK_ROOT/$RUN_ID"
# Isolated CODEX_HOME: only the login is shared (symlink), so the user's
# AGENTS.md, config, skills, plugins and memories are not loaded.
CODEX_HOME_DIR="$WORK_ROOT/.homes/$RUN_ID"
RUN_DIR="$REPO/runs/$RUN_ID"

if [ -d "$WORK" ] && [ -n "$(ls -A "$WORK")" ]; then
  echo "work folder is not empty: $WORK" >&2; exit 1
fi
mkdir -p "$WORK" "$RUN_DIR" "$CODEX_HOME_DIR"
if git -C "$WORK" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "work folder is inside a git repo: $WORK" >&2; exit 1
fi
ln -sf "$HOME/.codex/auth.json" "$CODEX_HOME_DIR/auth.json"

CODEX_BIN="$(command -v codex)"
CLI_VERSION="$("$CODEX_BIN" --version | awk '{print $2}')"
START_EPOCH="$(date +%s)"
START_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "running" > "$RUN_DIR/status"

set +e
cd "$WORK" && env -i \
  HOME="$HOME" USER="$USER" LOGNAME="${LOGNAME:-$USER}" SHELL="${SHELL:-/bin/zsh}" \
  PATH="$PATH" LANG="${LANG:-en_US.UTF-8}" TMPDIR="${TMPDIR:-/tmp}" TERM=xterm-256color \
  CODEX_HOME="$CODEX_HOME_DIR" \
  "$CODEX_BIN" exec --json --skip-git-repo-check --ignore-rules \
    -m "$MODEL" -c model_reasoning_effort="$EFFORT" \
    --approve-for-me -c sandbox_workspace_write.network_access=true \
    --disable apps --disable plugins --disable remote_plugin \
    --disable computer_use --disable browser_use_external \
    "$(cat "$PROMPT_FILE")" \
  < /dev/null > "$RUN_DIR/stream.jsonl" 2> "$RUN_DIR/stderr.log"
EXIT_CODE=$?
set -e

END_EPOCH="$(date +%s)"
TILDE='~'
cat > "$RUN_DIR/meta.json" <<EOF
{
  "level": "$RUN_ID",
  "agent": "codex",
  "model": "$MODEL",
  "effort": "$EFFORT",
  "prompt": "$(basename "$PROMPT_FILE")",
  "cli_version": "$CLI_VERSION",
  "work_dir": "${WORK/#$HOME/$TILDE}",
  "codex_home": "${CODEX_HOME_DIR/#$HOME/$TILDE}",
  "started_utc": "$START_ISO",
  "wall_seconds": $((END_EPOCH - START_EPOCH)),
  "exit_code": $EXIT_CODE
}
EOF
echo "done $EXIT_CODE" > "$RUN_DIR/status"
