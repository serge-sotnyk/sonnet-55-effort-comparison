# Sonnet 5.5: reasoning levels, one game prompt

A replication of [Barty-Bart/opus-55-effort-comparison](https://github.com/Barty-Bart/opus-55-effort-comparison) (commit `203aaae`) with `claude-sonnet-5-5` instead of `claude-opus-5-5`. The original experiment is shown in [this video](https://youtu.be/kQFzX_hKHns). The prompts in [prompts/](prompts/) are byte-identical copies of the originals.

## Play

Online: **https://serge-sotnyk.github.io/sonnet-55-effort-comparison/**

Or locally from the repository folder:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8766/games/<level>/`.

## Results

| Build | Elapsed | API time | Total tokens | Est. cost (API list) | Weekly limit (Team) | Opus 5.5 for comparison |
|---|---:|---:|---:|---:|---|---|
| [Low](games/low/) | 25m 07s | 23m 15s | 8,056,152 | $4.30 | 1% → 2% | 19m 10s · 3,140,950 · $3.79 |
| [High](games/high/) | 1h 25m 34s | 1h 06m 43s | 106,831,205 | $28.85 | 2% → 4% | 1h 00m 33s · 30,665,190 · $16.11 |

Full metrics are in [results.json](results.json); per-run final result events are in `runs/<level>/result.json`.

## Codex runs (same original prompt)

| Build | Elapsed | Total tokens | Main model tokens (in / out) | Est. cost (main model) | Codex weekly limit |
|---|---:|---:|---:|---:|---|
| [gpt-6.1-sol · high](games/codex-gpt-6.1-sol-high/) | 21m 17s | 2,549,619 | 2,264,705 / 50,907 | ~$0.89 | 3% → 3% |
| [gpt-6.1-sol · xhigh](games/codex-gpt-6.1-sol-xhigh/) | 46m 48s | 3,206,402 | 2,948,318 / 102,951 | ~$1.63 | 9% → 10% |
| [gpt-6.1-sol · ultra](games/codex-gpt-6.1-sol-ultra/) | 21m 39s | 8,587,394 | 8,170,516 / 127,692 | ~$2.89 | 4% → 5% |
| [gpt-6-astra · high](games/codex-gpt-6-astra-high/) | 18m 14s | 1,600,640 | 1,378,948 / 40,405 | ~$3.96 | 3% → 4% |
| [gpt-6-astra · xhigh](games/codex-gpt-6-astra-xhigh/) | 40m 28s | 3,074,447 | 2,840,121 / 83,618 | ~$8.35 | 10% → 12% |
| [gpt-6-astra · ultra](games/codex-gpt-6-astra-ultra/) | 18m 17s | 5,969,302 | 5,665,767 / 80,583 | ~$12.31 | 5% → 9% |

- `scripts/run-codex.sh <model> <effort>` runs `codex exec --json` (CLI 0.160.0) in a fresh folder with an isolated `CODEX_HOME` that shares only the login, so the user's `AGENTS.md`, config, skills, plugins and memories are not loaded. Apps, plugins, computer use and external-browser use are disabled; `--approve-for-me` (workspace-write sandbox with automatic approval review) with network access enabled.
- `scripts/collect-codex.py` sums token usage from all session rollouts of the run, including the `codex-auto-review` approval reviewer (~0.2M tokens per run), and reads the weekly limit from the rollouts' rate-limit snapshots. Metrics are in [results-codex.json](results-codex.json).
- Exported builds exclude `node_modules`; the xhigh and ultra builds also exclude the caches, build output, test results and screenshots listed in their own `.gitignore`. The only source changes make root-absolute asset paths relative, so the builds run from a subfolder on GitHub Pages: `index.html` of sol · ultra, sol · xhigh and astra · xhigh (stylesheet and entry script), and the two font URLs in astra · xhigh's `src/style.css`.
- Input tokens include cached input (OpenAI convention). The dollar estimate uses third-party list prices (gpt-6.1-sol $2 / $0.10 cached / $10 output, gpt-6-astra $10 / $1 / $50 per 1M) and excludes the reviewer, which has no public price.

## How the runs differ from the original

Step-by-step notes for repeating the runs, including the isolation pitfalls and the path fixes for GitHub Pages, are in [RUNBOOK.md](RUNBOOK.md).

- Each run: `scripts/run-level.sh <level>` in a fresh empty folder (`~/sonnet-55-experiment/<level>`) outside any git repo.
- Headless (`claude -p … --output-format stream-json`) instead of an interactive session; same prompt, no follow-up prompts.
- `--safe-mode`, auto-memory disabled (`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, `autoMemoryEnabled: false`), clean environment without API-key/base-URL overrides, subscription login.
- `--permission-mode auto` instead of manual approvals; denials are counted in `results.json`.
- CLI version is recorded per run (Low: 2.1.289; the original used 2.1.281).
