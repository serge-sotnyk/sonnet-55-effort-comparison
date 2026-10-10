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
    # A run can end several turns (e.g. when the model waits on background
    # monitors). Within one process, cost, usage, API time and subagent stats are
    # cumulative, so the last result event holds the totals; turns and denials
    # are per segment. A run resumed after an interruption (resume-level.sh) adds
    # stream-2.jsonl, ...; the resumed session carries its cost, usage and API
    # time forward, so the last part's final event holds the run's totals too.
    parts = [(run_dir / "stream.jsonl", meta)]
    n = 2
    while (run_dir / f"stream-{n}.jsonl").exists():
        part_meta = run_dir / f"meta-{n}.json"
        parts.append((run_dir / f"stream-{n}.jsonl",
                      json.loads(part_meta.read_text()) if part_meta.exists() else {}))
        n += 1

    all_results, finals = [], []
    for stream, _ in parts:
        results = []
        for line in stream.read_text().splitlines():
            try:
                event = json.loads(line)
            except json.JSONDecodeError:
                continue
            if event.get("type") == "result":
                results.append(event)
        all_results += results
        if results:
            finals.append(results[-1])
    if not finals:
        sys.exit(f"no result event in {run_dir}")
    result = finals[-1]

    # modelUsage covers the main loop and any subagents, per model.
    models = result.get("modelUsage", {})
    tokens = {
        "input": sum(m.get("inputTokens", 0) for m in models.values()),
        "output": sum(m.get("outputTokens", 0) for m in models.values()),
        "cache_read": sum(m.get("cacheReadInputTokens", 0) for m in models.values()),
        "cache_write": sum(m.get("cacheCreationInputTokens", 0) for m in models.values()),
    }
    wall_seconds = sum(m.get("wall_seconds", 0) for _, m in parts)
    exit_code = parts[-1][1].get("exit_code", meta["exit_code"])
    row = {
        "effort": LABELS[level],
        "model": meta["model"],
        "cost": round(result.get("total_cost_usd", 0), 2),
        **tokens,
        "total_tokens": sum(tokens.values()),
        "elapsed": fmt_duration(wall_seconds),
        "api_time": fmt_duration(result.get("duration_api_ms", 0) / 1000),
        "num_turns": sum(r.get("num_turns") or 0 for r in all_results),
        "result_segments": len(all_results),
        "parts": len(parts),
        "cost_by_part": [round(b.get("total_cost_usd", 0) - a.get("total_cost_usd", 0), 2)
                         for a, b in zip([{}] + finals[:-1], finals)],
        "subagents_spawned": sum(f.get("subagent_stats", {}).get("spawned") or 0 for f in finals),
        "permission_denials": sum(len(r.get("permission_denials") or []) for r in all_results),
        "cost_by_model": {k: round(v.get("costUSD", 0), 2) for k, v in models.items()},
        "cli_version": meta["cli_version"],
        "status": "Complete" if result.get("subtype") == "success" and not result.get("is_error")
                  and exit_code == 0
                  else f"Ended: {result.get('subtype')} / exit {exit_code}",
        "play": f"games/{level}/",
    }

    (run_dir / "result.json").write_text(json.dumps(
        {k: v for k, v in result.items() if k not in ("session_id", "uuid", "result")},
        indent=2) + "\n")

    results_path = REPO / "results.json"
    rows = json.loads(results_path.read_text()) if results_path.exists() else []
    # Keep fields added by hand (e.g. usage_limits) when re-collecting.
    old = next((r for r in rows if r.get("effort") == row["effort"]), {})
    row = {**old, **row}
    rows = [r for r in rows if r.get("effort") != row["effort"]] + [row]
    rows.sort(key=lambda r: ORDER.index(next(k for k, v in LABELS.items() if v == r["effort"])))
    results_path.write_text(json.dumps(rows, indent=2) + "\n")
    print(json.dumps(row, indent=2))


if __name__ == "__main__":
    main(sys.argv[1])
