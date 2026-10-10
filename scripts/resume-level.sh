#!/usr/bin/env bash
# Resumes an interrupted build (e.g. one that hit the session limit) in the same
# session and folder, with a neutral "Continue" and the same flags as run-level.sh.
# Usage: scripts/resume-level.sh <level> <session-id>
# Writes the next part as runs/<level>/stream-<n>.jsonl and meta-<n>.json.
set -euo pipefail

LEVEL="${1:?usage: resume-level.sh <level> <session-id>}"
SESSION_ID="${2:?usage: resume-level.sh <level> <session-id>}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
WORK_ROOT="${WORK_ROOT:-$HOME/sonnet-55-experiment}"
MODEL="${MODEL:-claude-sonnet-5-5}"

case "$LEVEL" in
  low|medium|high|xhigh|max) EFFORT="$LEVEL" ;;
  special) EFFORT="low" ;;
  *) echo "unknown level: $LEVEL" >&2; exit 2 ;;
esac

WORK="$WORK_ROOT/$LEVEL"
RUN_DIR="$REPO/runs/$LEVEL"
[ -d "$WORK" ] || { echo "no work folder: $WORK" >&2; exit 1; }

PART=2
while [ -e "$RUN_DIR/stream-$PART.jsonl" ]; do PART=$((PART + 1)); done

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
usage_snapshot "$RUN_DIR/usage-before-$PART.txt"
echo "running part $PART" > "$RUN_DIR/status"

set +e
cd "$WORK" && env -i \
  HOME="$HOME" USER="$USER" LOGNAME="${LOGNAME:-$USER}" SHELL="${SHELL:-/bin/zsh}" \
  PATH="$PATH" LANG="${LANG:-en_US.UTF-8}" TMPDIR="${TMPDIR:-/tmp}" TERM=xterm-256color \
  CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 \
  "$CLAUDE_BIN" -p "Continue" \
    --resume "$SESSION_ID" \
    --safe-mode \
    --model "$MODEL" \
    --effort "$EFFORT" \
    --permission-mode auto \
    --no-chrome \
    --settings '{"autoMemoryEnabled":false}' \
    --output-format stream-json --verbose \
  > "$RUN_DIR/stream-$PART.jsonl" 2> "$RUN_DIR/stderr-$PART.log"
EXIT_CODE=$?
set -e

END_EPOCH="$(date +%s)"
usage_snapshot "$RUN_DIR/usage-after-$PART.txt"
cat > "$RUN_DIR/meta-$PART.json" <<EOF
{
  "level": "$LEVEL",
  "part": $PART,
  "resumed_session": "$SESSION_ID",
  "prompt": "Continue",
  "cli_version": "$CLI_VERSION",
  "started_utc": "$START_ISO",
  "wall_seconds": $((END_EPOCH - START_EPOCH)),
  "exit_code": $EXIT_CODE
}
EOF
echo "done $EXIT_CODE part $PART" > "$RUN_DIR/status"
