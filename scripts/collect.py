#!/usr/bin/env python3
"""Extracts the final metrics of a run into results.json.

Usage: scripts/collect.py <level>
Reads runs/<level>/stream.jsonl + meta.json, writes runs/<level>/result.json
and upserts the summary row into results.json.
"""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
LABELS = {"low": "Low", "medium": "Medium", "high": "High", "xhigh": "X High",
          "max": "Max", "special": "Special Build (Low)"}
ORDER = list(LABELS)


def fmt_duration(seconds):
    seconds = int(round(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}h {m:02d}m {s:02d}s" if h else f"{m}m {s:02d}s"


def main(level):
    run_dir = REPO / "runs" / level
    meta = json.loads((run_dir / "meta.json").read_text())
    result = None
    for line in (run_dir / "stream.jsonl").read_text().splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") == "result":
            result = event
    if result is None:
        sys.exit(f"no result event in {run_dir / 'stream.jsonl'}")

    # modelUsage covers the main loop and any subagents, per model.
    models = result.get("modelUsage", {})
    tokens = {
        "input": sum(m.get("inputTokens", 0) for m in models.values()),
        "output": sum(m.get("outputTokens", 0) for m in models.values()),
        "cache_read": sum(m.get("cacheReadInputTokens", 0) for m in models.values()),
        "cache_write": sum(m.get("cacheCreationInputTokens", 0) for m in models.values()),
    }
    row = {
        "effort": LABELS[level],
        "model": meta["model"],
        "cost": round(result.get("total_cost_usd", 0), 2),
        **tokens,
        "total_tokens": sum(tokens.values()),
        "elapsed": fmt_duration(meta["wall_seconds"]),
        "api_time": fmt_duration(result.get("duration_api_ms", 0) / 1000),
        "num_turns": result.get("num_turns"),
        "subagents_spawned": result.get("subagent_stats", {}).get("spawned"),
        "permission_denials": len(result.get("permission_denials", [])),
        "cost_by_model": {k: round(v.get("costUSD", 0), 2) for k, v in models.items()},
        "cli_version": meta["cli_version"],
        "status": "Complete" if result.get("subtype") == "success" and meta["exit_code"] == 0
                  else f"Ended: {result.get('subtype')} / exit {meta['exit_code']}",
        "play": f"games/{level}/",
    }

    (run_dir / "result.json").write_text(json.dumps(
        {k: v for k, v in result.items() if k not in ("session_id", "uuid", "result")},
        indent=2) + "\n")

    results_path = REPO / "results.json"
    rows = json.loads(results_path.read_text()) if results_path.exists() else []
    rows = [r for r in rows if r.get("effort") != row["effort"]] + [row]
    rows.sort(key=lambda r: ORDER.index(next(k for k, v in LABELS.items() if v == r["effort"])))
    results_path.write_text(json.dumps(rows, indent=2) + "\n")
    print(json.dumps(row, indent=2))


if __name__ == "__main__":
    main(sys.argv[1])
