#!/usr/bin/env python3
"""Extracts the metrics of a Codex run into results-codex.json.

Usage: scripts/collect-codex.py <run-id>      e.g. codex-gpt-6.1-sol-high
Token usage comes from the session rollouts in the run's isolated CODEX_HOME
(every rollout there belongs to this run, subagents included); the weekly
limit comes from the first and last rate_limits snapshot.
"""
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
# USD per 1M tokens (input, cached input, output), standard tier, from
# third-party pricing write-ups (Oct 2026); treat the cost as an estimate.
# codex-auto-review has no public API price and is left out of the cost.
PRICES = {
    "gpt-6.1-sol": (2.00, 0.10, 10.00),
    "gpt-6-astra": (10.00, 1.00, 50.00),
}
EFFORTS = ["low", "medium", "high", "xhigh", "max", "ultra"]


def fmt_duration(seconds):
    seconds = int(round(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}h {m:02d}m {s:02d}s" if h else f"{m}m {s:02d}s"


def token_events(path):
    for line in path.read_text().splitlines():
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        payload = event.get("payload", event)
        if payload.get("type") == "token_count":
            yield event.get("timestamp", ""), payload


def rollout_model(path):
    """Model of a rollout: its first turn_context, e.g. 'gpt-6.1-sol/high'."""
    for line in path.read_text().splitlines():
        if '"turn_context"' not in line:
            continue
        payload = json.loads(line).get("payload", {})
        return f"{payload.get('model')}/{payload.get('effort')}"
    return "unknown"


def main(run_id):
    run_dir = REPO / "runs" / run_id
    meta = json.loads((run_dir / "meta.json").read_text())
    home = Path(meta["codex_home"].replace("~", str(Path.home()), 1))
    rollouts = sorted(home.glob("sessions/**/*.jsonl"))
    if not rollouts:
        sys.exit(f"no rollouts in {home}")

    totals = {"input": 0, "cached_input": 0, "output": 0, "reasoning_output": 0}
    by_model = {}
    snapshots = []
    for path in rollouts:
        last = None
        model = rollout_model(path)
        for ts, payload in token_events(path):
            if payload.get("info"):
                last = payload["info"]["total_token_usage"]
            if payload.get("rate_limits"):
                snapshots.append((ts, payload["rate_limits"]))
        if last:
            usage = {
                "input": last.get("input_tokens", 0),
                "cached_input": last.get("cached_input_tokens", 0),
                "output": last.get("output_tokens", 0),
                "reasoning_output": last.get("reasoning_output_tokens", 0),
            }
            for k, v in usage.items():
                totals[k] += v
            acc = by_model.setdefault(model, dict.fromkeys(usage, 0))
            for k, v in usage.items():
                acc[k] += v
    snapshots.sort(key=lambda s: s[0])

    def weekly(rl):
        primary = rl.get("primary") or {}
        return primary.get("used_percent")

    def cost(model_key, u):
        price = PRICES.get(model_key.split("/")[0])
        if not price:
            return None
        uncached = u["input"] - u["cached_input"]
        return (uncached * price[0] + u["cached_input"] * price[1] + u["output"] * price[2]) / 1e6

    main_key = f"{meta['model']}/{meta['effort']}"
    est_cost = cost(main_key, by_model[main_key]) if main_key in by_model else None

    turns = sum(1 for line in (run_dir / "stream.jsonl").read_text().splitlines()
                if '"type":"turn.completed"' in line)
    row = {
        "effort": f"{meta['model']} · {meta['effort']}",
        "agent": "codex",
        "model": meta["model"],
        "reasoning_effort": meta["effort"],
        # OpenAI convention: input includes cached input; reasoning is part of output.
        **totals,
        "total_tokens": totals["input"] + totals["output"],
        "est_cost_main_model": round(est_cost, 2) if est_cost is not None else None,
        "elapsed": fmt_duration(meta["wall_seconds"]),
        "turns": turns,
        "rollouts": len(rollouts),
        # The main model plus codex-auto-review (the --approve-for-me reviewer).
        "tokens_by_model": by_model,
        "weekly_limit_before": weekly(snapshots[0][1]) if snapshots else None,
        "weekly_limit_after": weekly(snapshots[-1][1]) if snapshots else None,
        "plan": snapshots[-1][1].get("plan_type") if snapshots else None,
        "cli_version": meta["cli_version"],
        "status": "Complete" if meta["exit_code"] == 0 else f"Ended: exit {meta['exit_code']}",
        "play": f"games/{run_id}/",
    }

    results_path = REPO / "results-codex.json"
    rows = json.loads(results_path.read_text()) if results_path.exists() else []
    old = next((r for r in rows if r.get("play") == row["play"]), {})
    row = {**old, **row}
    rows = [r for r in rows if r.get("play") != row["play"]] + [row]
    rows.sort(key=lambda r: (list(PRICES).index(r["model"]) if r["model"] in PRICES else 99,
                             EFFORTS.index(r["reasoning_effort"]) if r["reasoning_effort"] in EFFORTS else 99))
    results_path.write_text(json.dumps(rows, indent=2) + "\n")
    print(json.dumps(row, indent=2))


if __name__ == "__main__":
    main(sys.argv[1])
