#!/usr/bin/env bash
# Runs one build of the experiment in a fresh, empty folder outside any git repo.
# Usage: scripts/run-level.sh <low|medium|high|xhigh|max|special>
set -euo pipefail

LEVEL="${1:?usage: run-level.sh <low|medium|high|xhigh|max|special>}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORK_ROOT="${WORK_ROOT:-$HOME/sonnet-55-experiment}"
MODEL="${MODEL:-claude-sonnet-5-5}"

case "$LEVEL" in
  low|medium|high|xhigh|max) EFFORT="$LEVEL"; PROMPT_FILE="$REPO/prompts/original.txt" ;;
  special) EFFORT="low"; PROMPT_FILE="$REPO/prompts/special-build.txt" ;;
  *) echo "unknown level: $LEVEL" >&2; exit 2 ;;
esac

WORK="$WORK_ROOT/$LEVEL"
RUN_DIR="$REPO/runs/$LEVEL"

if [ -d "$WORK" ] && [ -n "$(ls -A "$WORK")" ]; then
  echo "work folder is not empty: $WORK" >&2; exit 1
fi
mkdir -p "$WORK" "$RUN_DIR"
if git -C "$WORK" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "work folder is inside a git repo: $WORK" >&2; exit 1
fi

CLAUDE_BIN="$(command -v claude)"

# Subscription usage snapshot (/usage is answered locally, no model call).
usage_snapshot() {
  (cd "$WORK" && env -i HOME="$HOME" USER="$USER" LOGNAME="${LOGNAME:-$USER}" PATH="$PATH" \
    LANG="${LANG:-en_US.UTF-8}" TMPDIR="${TMPDIR:-/tmp}" TERM=xterm-256color \
    "$CLAUDE_BIN" -p "/usage" --safe-mode < /dev/null 2>&1 | sed -n '/^Current/p') > "$1" || true
}
CLI_VERSION="$("$CLAUDE_BIN" --version | awk '{print $1}')"
START_EPOCH="$(date +%s)"
START_ISO="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
usage_snapshot "$RUN_DIR/usage-before.txt"
echo "running" > "$RUN_DIR/status"

# Clean environment, as from a fresh terminal: no inherited desktop-session,
# API-key or base-URL overrides; subscription login comes from the keychain.
set +e
cd "$WORK" && env -i \
  HOME="$HOME" USER="$USER" LOGNAME="${LOGNAME:-$USER}" SHELL="${SHELL:-/bin/zsh}" \
  PATH="$PATH" LANG="${LANG:-en_US.UTF-8}" TMPDIR="${TMPDIR:-/tmp}" TERM=xterm-256color \
  CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 \
  "$CLAUDE_BIN" -p "$(cat "$PROMPT_FILE")" \
    --safe-mode \
    --model "$MODEL" \
    --effort "$EFFORT" \
    --permission-mode auto \
    --no-chrome \
    --settings '{"autoMemoryEnabled":false}' \
    --output-format stream-json --verbose \
  > "$RUN_DIR/stream.jsonl" 2> "$RUN_DIR/stderr.log"
EXIT_CODE=$?
set -e

END_EPOCH="$(date +%s)"
usage_snapshot "$RUN_DIR/usage-after.txt"
TILDE='~'
cat > "$RUN_DIR/meta.json" <<EOF
{
  "level": "$LEVEL",
  "model": "$MODEL",
  "effort": "$EFFORT",
  "prompt": "$(basename "$PROMPT_FILE")",
  "cli_version": "$CLI_VERSION",
  "work_dir": "${WORK/#$HOME/$TILDE}",
  "started_utc": "$START_ISO",
  "wall_seconds": $((END_EPOCH - START_EPOCH)),
  "exit_code": $EXIT_CODE
}
EOF
echo "done $EXIT_CODE" > "$RUN_DIR/status"
