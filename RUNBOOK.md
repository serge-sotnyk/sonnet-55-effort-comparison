# Runbook: repeating these runs

Practical notes from running the Claude Code and Codex builds in this repository. The scripts already encode most of it; this file explains why each step exists and what went wrong without it.

## Order of work for one build

1. Ask the person running the experiment for their usage before the run (Claude: `/usage` or the app's usage panel; Codex records it itself, see below).
2. Smoke-test the exact command with a trivial prompt (costs cents) whenever flags, CLI version or model change.
3. Launch the real run detached and wait for it to finish.
4. Collect metrics.
5. Copy the build into `games/<id>/`, clean it, fix paths for GitHub Pages, scan it.
6. Open it in a browser, confirm a match starts and runs without console errors, then close the tab.
7. Stop servers the run left behind. Leave everything else alone.
8. Update README and the landing page data, then commit and push when asked.

Run one build at a time. Builds tend to pick the same ports (5173, 8000, 8765) and their browser tests can collide.

## Claude Code runs (`scripts/run-level.sh`)

**Isolation**
- Work folder outside any git repo (`~/sonnet-55-experiment/<level>`). Inside a repo the model sees its git state, CLAUDE.md files up the tree and sibling builds. The script refuses a non-empty folder or one inside a work tree.
- `--safe-mode` disables CLAUDE.md, skills, plugins, hooks, MCP servers and custom agents.
- Auto-memory is off in two ways: `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` and `--settings '{"autoMemoryEnabled":false}'`.
- **Start the child with a clean environment (`env -i` plus HOME, USER, PATH, LANG, TMPDIR, TERM).** A Claude Code session launched from another Claude session, especially the desktop app, inherits variables such as `CLAUDE_EFFORT`, `CLAUDE_CODE_CHILD_SESSION`, messaging sockets and an `ANTHROPIC_BASE_URL` proxy. Without `env -i` these leak into the run and can change its effort level or where its requests go. With `env -i` and no API key, the CLI uses the subscription login from the keychain; the smoke test's `"provider": "firstParty"` confirms it.
- `--no-chrome` keeps the run away from the user's real Chrome.

**Running**
- Headless: `claude -p "<prompt>" --model … --effort … --permission-mode auto --output-format stream-json --verbose`. Auto mode approves routine actions and blocks risky ones. Denials are counted; none happened in these runs.
- Launch with `nohup … &`. A run can outlast the orchestrating tool's background-command limit (2 hours here). Wait on the `runs/<id>/status` file, not on the process.
- The prompt's "leave it running" means the model starts its own server. It survives the run; stop it afterwards (see Cleanup).

**Metrics (`scripts/collect.py`)**
- The final `result` event in `stream.jsonl` holds `total_cost_usd` (API list-price equivalent), `modelUsage` per model (subagents included), `duration_api_ms` and `subagent_stats`.
- **A run can emit several `result` events.** This happens when the model waits on its own background monitors: each wait ends a turn, and the session resumes when the monitor fires. Cost, usage, API time and subagent stats are cumulative, so take them from the last event. `num_turns` and `permission_denials` are per segment, so sum them. The High run had 16 segments; summing everything gave 16 subagents instead of 1.
- Subscription limits are not in the stream. Read `/usage` before and after; the values are whole percentages and include the orchestrating session. The 5-hour session window can reset mid-run, which makes the session delta meaningless; use the weekly delta then.
- `collect.py` keeps hand-added fields (such as `usage_limits`) when it re-collects a row.

## Codex runs (`scripts/run-codex.sh`)

**Isolation**
- **`--ignore-user-config` does not stop Codex from loading the user's global `~/.codex/AGENTS.md`, and neither does `-c project_doc_max_bytes=0`.** The only reliable fix is a separate `CODEX_HOME` per run (`~/codex-experiment/.homes/<id>`) containing just a symlink to `~/.codex/auth.json`. That also keeps out the user's config, skills, plugins and memories, and keeps the run's session logs separate for metrics.
- Check isolation with a probe before real runs: ask "Do you have any instructions from an AGENTS.md file or user-level custom instructions? Quote their first line or reply NONE." It must answer `NONE`.
- Disable features that reach outside the sandbox: `--disable apps --disable plugins --disable remote_plugin --disable computer_use --disable browser_use_external`. Computer use could drive the user's desktop while they are away. The built-in headless browser stays on so the model can test its game.
- `--skip-git-repo-check` lets Codex run in a folder that is not a git repo.
- Pass `< /dev/null`. Otherwise Codex waits for extra input on stdin.

**Permissions**
- `--approve-for-me` gives the workspace-write sandbox with an automatic approval reviewer. It cannot be combined with `--sandbox`.
- Network is off in that sandbox by default. Enable it with `-c sandbox_workspace_write.network_access=true`, so the model can `npm install` test tools as the Claude runs could.

**Metrics (`scripts/collect-codex.py`)**
- Codex reports tokens, not dollars. The `--json` stream's `turn.completed` covers only the main thread.
- Use the session rollouts in the isolated `CODEX_HOME/sessions/`: each rollout's last `token_count` event has cumulative `total_token_usage`. Sum all rollouts. They include subagents (6–7 rollouts on `ultra`) and the `codex-auto-review` reviewer (about 0.2M tokens per run). Each rollout's model comes from its `turn_context`.
- The same events carry `rate_limits.primary.used_percent`: the weekly limit, with no screenshot needed. The first and last snapshot give before and after.
- Input includes cached input (OpenAI convention), and reasoning is part of output. Total tokens are therefore input + output.
- The dollar estimate uses a price table in the script, taken from third-party write-ups, since OpenAI's own page was not found. It excludes the reviewer, which has no public price.
- A trailing `failed to record rollout items: thread … not found` error in `stderr.log` is harmless: the main model's rollout totals matched `turn.completed`.

## Exporting a build to `games/`

**What to copy**
- Copy source only. Exclude `node_modules` and anything else in the build's own `.gitignore`: browser and npm caches (over 300 MB in one Codex build), `dist`, `test-results` and screenshot artifacts.
- Scan for local paths and personal data before committing: `grep -rlE "/Users/|<username>|<email domain>"`. Run metadata stores `~/…` paths instead of absolute ones.
- List external URLs (`grep -oE 'https?://…'`). Several Codex builds load Google Fonts; this was left as generated.

**Make the build work on GitHub Pages**
- **Root-absolute asset paths break on GitHub Pages**, because the site lives at `/<repo>/games/<id>/`. A path such as `/style.css` resolves to the domain root. Vite and Node-server builds tend to produce them: `href="/style.css"`, `src="/src/app.js"`, `url('/assets/fonts/…')`.
- Find them with `grep -nE "[\"'\`]/[a-zA-Z]" index.html *.js src/*` and `grep -oE "url\([^)]+\)" *.css src/*.css`.
- Rewrite them as relative paths in the copy only. In `index.html`, `/src/app.js` becomes `src/app.js`. In a stylesheet the path is relative to the CSS file, so `src/style.css` needs `url('../assets/fonts/…')`.
- Document every such change in README and in the page note. So far: sol · ultra, sol · xhigh and astra · xhigh.
- Prefer the unbuilt source when its ES modules load directly. A `dist/` build also has root-absolute paths, and its hashed bundle is harder to review.
- After pushing, check the game's entry script and fonts with `curl` on the Pages URL. The site builds in about a minute; `.nojekyll` stops Jekyll from touching the files.

## Browser check

- Start the repo-root preview server (`.claude/launch.json`, port 8766) and open `games/<id>/`. Click through the start screen, then check the console for errors and that a resource counter or game clock advances.
- **A hidden browser pane throttles `requestAnimationFrame` to about 1 fps** (`document.visibilityState === "hidden"`). A game then looks frozen. Front the tab and compare the clock, not just resources. Some games also start with idle villagers, so resources only move once villagers are tasked or deliver.
- Close the tab and stop the server when done. A loaded game keeps playing music after its server stops.
- When checking the landing page locally, re-fetch the JSON with `{cache: "reload"}`. Otherwise the browser shows stale rows.

## Cleanup

- Builds leave servers running (ports 5173, 4173, 8000, 8765). Identify them with `lsof -iTCP -sTCP:LISTEN -P` and the process's working directory (`lsof -a -p <pid> -d cwd`). Kill only those whose cwd is a run folder; ports may be shared with unrelated servers of the person running the experiment.
- To abort a run, kill `run-*.sh` and its `claude`/`codex` child, stop the waiting task, and delete `runs/<id>/`, the work folder, and for Claude its transcript folder under `~/.claude/projects/`.
