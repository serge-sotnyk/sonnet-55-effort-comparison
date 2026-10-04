# Sonnet 5.5: reasoning levels, one game prompt

A replication of [Barty-Bart/opus-55-effort-comparison](https://github.com/Barty-Bart/opus-55-effort-comparison) (commit `203aaae`) with `claude-sonnet-5-5` instead of `claude-opus-5-5`. The prompts in [prompts/](prompts/) are byte-identical copies of the originals.

## Play

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

Then open `http://127.0.0.1:8766/games/<level>/`.

## Results

| Build | Elapsed | API time | Total tokens | Est. cost (API list) | Weekly limit (Team) | Opus 5.5 for comparison |
|---|---:|---:|---:|---:|---|---|
| [Low](games/low/) | 25m 07s | 23m 15s | 8,056,152 | $4.30 | 1% → 2% | 19m 10s · 3,140,950 · $3.79 |

Full metrics are in [results.json](results.json); per-run final result events are in `runs/<level>/result.json`.

## How the runs differ from the original

- Each run: `scripts/run-level.sh <level>` in a fresh empty folder (`~/sonnet-55-experiment/<level>`) outside any git repo.
- Headless (`claude -p … --output-format stream-json`) instead of an interactive session; same prompt, no follow-up prompts.
- `--safe-mode`, auto-memory disabled (`CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, `autoMemoryEnabled: false`), clean environment without API-key/base-URL overrides, subscription login.
- `--permission-mode auto` instead of manual approvals; denials are counted in `results.json`.
- CLI version is recorded per run (Low: 2.1.289; the original used 2.1.281).
