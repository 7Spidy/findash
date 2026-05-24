"""
generate_insights.py
────────────────────
Analyses the latest transactions and generates AI-powered spending insights
by calling the Anthropic Claude API. Output is written to data/insights.json.

The prompt sends only aggregated statistics to Claude (not raw transactions),
keeping the payload small and the response structured as parseable JSON.

Requires:
    ANTHROPIC_API_KEY environment variable (or .env file in repo root)

Run standalone:
    python pipeline/generate_insights.py
"""

import json
import logging
import os
import sys
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

# ─── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
log = logging.getLogger(__name__)

# ─── Paths ────────────────────────────────────────────────────────────────────
REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / "data"
TRANSACTIONS_PATH = DATA_DIR / "transactions.json"
INSIGHTS_PATH = DATA_DIR / "insights.json"

TODAY = date.today()


# ─── Data aggregation helpers ─────────────────────────────────────────────────

def _month_str(d: date) -> str:
    return d.strftime("%Y-%m")


def aggregate_for_prompt(transactions: list[dict]) -> dict:
    """
    Compute category totals, merchant totals, and recurring patterns
    from the last 3 months of transactions.
    Returns a structured dict suitable for the Claude prompt.
    """
    this_month = _month_str(TODAY)
    last_month = _month_str(TODAY.replace(day=1) - timedelta(days=1))
    two_months_ago = _month_str(TODAY.replace(day=1) - timedelta(days=32))

    months_in_scope = {this_month, last_month, two_months_ago}

    # Filter to debits only (spending analysis)
    debits = [t for t in transactions if t["type"] == "debit" and t["date"][:7] in months_in_scope]

    # Category totals per month
    cat_month: dict[str, dict[str, float]] = defaultdict(lambda: defaultdict(float))
    for t in debits:
        cat_month[t["date"][:7]][t["category"]] += t["amount"]

    # Merchant totals this month
    merchant_totals: dict[str, float] = defaultdict(float)
    merchant_counts: dict[str, int] = defaultdict(int)
    for t in debits:
        if t["date"][:7] == this_month:
            merchant_totals[t["merchant"]] += t["amount"]
            merchant_counts[t["merchant"]] += 1

    top_merchants = sorted(
        [{"merchant": m, "total": round(v, 2), "count": merchant_counts[m]} for m, v in merchant_totals.items()],
        key=lambda x: x["total"],
        reverse=True,
    )[:15]

    # Recurring charge detection: merchant appeared in all 3 months
    all_months_merchants: list[set] = [
        {t["merchant"] for t in debits if t["date"][:7] == m}
        for m in [this_month, last_month, two_months_ago]
    ]
    recurring = set.intersection(*all_months_merchants) if len(all_months_merchants) == 3 else set()

    subscriptions = []
    for merchant in recurring:
        monthly_amounts = []
        for m in [this_month, last_month, two_months_ago]:
            total = sum(t["amount"] for t in debits if t["merchant"] == merchant and t["date"][:7] == m)
            monthly_amounts.append(total)
        avg_amount = round(sum(monthly_amounts) / len(monthly_amounts), 2)
        # Only flag if consistent amount (within 10% variance)
        if max(monthly_amounts) / (min(monthly_amounts) or 1) < 1.1:
            category = next((t["category"] for t in debits if t["merchant"] == merchant), "Others")
            last_charged = max(t["date"] for t in debits if t["merchant"] == merchant)
            subscriptions.append({
                "name": merchant,
                "amount": avg_amount,
                "frequency": "monthly",
                "last_charged": last_charged,
                "category": category,
            })

    # Category summary for prompt
    all_categories = sorted({t["category"] for t in debits})
    category_summary = []
    for cat in all_categories:
        tm = round(cat_month[this_month].get(cat, 0), 2)
        lm = round(cat_month[last_month].get(cat, 0), 2)
        avg = round(cat_month[two_months_ago].get(cat, 0), 2)
        change_pct = round(((tm - lm) / lm * 100) if lm > 0 else 0, 1)
        category_summary.append({
            "category": cat,
            "this_month": tm,
            "last_month": lm,
            "avg_3m": round((tm + lm + avg) / 3, 2),
            "change_pct": change_pct,
        })

    total_this_month = round(sum(cat_month[this_month].values()), 2)
    total_last_month = round(sum(cat_month[last_month].values()), 2)

    return {
        "period": {
            "this_month": this_month,
            "last_month": last_month,
            "two_months_ago": two_months_ago,
        },
        "totals": {
            "this_month": total_this_month,
            "last_month": total_last_month,
            "change_pct": round(((total_this_month - total_last_month) / total_last_month * 100) if total_last_month > 0 else 0, 1),
        },
        "category_summary": category_summary,
        "top_merchants": top_merchants,
        "detected_subscriptions": subscriptions,
    }


# ─── Claude prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a personal finance advisor AI.
You analyse Indian consumer spending data and return structured JSON insights.
Be specific, actionable, and accurate. All monetary values are in INR.
Respond ONLY with valid JSON — no markdown fences, no explanation text."""

def build_user_prompt(agg: dict) -> str:
    return f"""Analyse this spending summary and return a JSON object with exactly these keys:

{{
  "alerts": [   // 2-4 items
    {{
      "type": "unused_subscription" | "spike" | "duplicate" | "large_single",
      "title": "short headline",
      "description": "1-2 sentence explanation with specific numbers",
      "estimated_saving": 0  // monthly INR saving if acted on, or 0
    }}
  ],
  "tips": [  // 3-5 specific actionable tips as plain strings
    "tip string with specific numbers"
  ]
}}

Spending data:
{json.dumps(agg, indent=2)}

Rules:
- Reference actual merchants and categories from the data
- "spike" alerts only when this_month > last_month by more than 20%
- Be specific: mention merchant names, exact amounts
- Tips should reference actual data points, not generic advice"""


# ─── Claude API call ──────────────────────────────────────────────────────────

def call_claude(prompt: str) -> dict:
    """
    Call Claude claude-sonnet-4-20250514 with the spending prompt.
    Returns parsed JSON dict, or raises on failure.
    """
    try:
        import anthropic
    except ImportError:
        raise ImportError("anthropic package not installed. Run: pip install anthropic")

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        # Try loading from .env file in repo root
        env_path = REPO_ROOT / ".env"
        if env_path.exists():
            for line in env_path.read_text().splitlines():
                if line.startswith("ANTHROPIC_API_KEY="):
                    api_key = line.split("=", 1)[1].strip().strip('"')
                    break

    if not api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY not set. Add it to environment variables or .env file."
        )

    client = anthropic.Anthropic(api_key=api_key)

    log.info("Calling Claude API for insights generation...")
    message = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = message.content[0].text.strip()
    log.info(f"Claude responded ({len(response_text)} chars).")

    # Strip markdown fences if Claude wraps in them despite instructions
    if response_text.startswith("```"):
        response_text = re.sub(r"^```[a-z]*\n?", "", response_text)
        response_text = re.sub(r"\n?```$", "", response_text)

    return json.loads(response_text)


# ─── Fallback insights (when Claude unavailable) ──────────────────────────────

def build_fallback_insights(agg: dict) -> dict:
    """
    Generate rule-based insights without the Claude API.
    Used when ANTHROPIC_API_KEY is not set or the API call fails.
    """
    alerts = []
    tips = []

    for cat in agg["category_summary"]:
        if cat["change_pct"] > 25 and cat["this_month"] > 1000:
            alerts.append({
                "type": "spike",
                "title": f"{cat['category']} spending up {cat['change_pct']}%",
                "description": (
                    f"Spent Rs.{cat['this_month']:,.0f} this month vs "
                    f"Rs.{cat['last_month']:,.0f} last month."
                ),
                "estimated_saving": round((cat["this_month"] - cat["last_month"]) * 0.5),
            })

    for sub in agg["detected_subscriptions"]:
        if sub["category"] == "Subscriptions":
            alerts.append({
                "type": "unused_subscription",
                "title": f"Recurring charge: {sub['name']}",
                "description": f"Rs.{sub['amount']:,.0f}/month detected as a regular subscription.",
                "estimated_saving": int(sub["amount"]),
            })

    # Generic tips based on data
    if agg["totals"]["change_pct"] > 10:
        tips.append(
            f"Total spending is up {agg['totals']['change_pct']}% this month "
            f"(Rs.{agg['totals']['this_month']:,.0f} vs Rs.{agg['totals']['last_month']:,.0f} last month). "
            "Review discretionary categories."
        )

    top = agg["top_merchants"][:3]
    if top:
        tips.append(
            f"Top 3 merchants this month: {', '.join(m['merchant'] for m in top)}. "
            "Consider setting per-merchant monthly budgets."
        )

    sub_total = sum(s["amount"] for s in agg["detected_subscriptions"])
    if sub_total > 0:
        tips.append(
            f"Detected Rs.{sub_total:,.0f}/month in recurring subscriptions. "
            "Review each for active usage."
        )

    return {"alerts": alerts[:4], "tips": tips[:5]}


# ─── Main ─────────────────────────────────────────────────────────────────────

import re  # noqa: E402 — imported here to avoid circular (also used in fallback)


def main() -> None:
    if not TRANSACTIONS_PATH.exists():
        log.error("transactions.json not found. Run parse_transactions.py first.")
        sys.exit(1)

    transactions = json.loads(TRANSACTIONS_PATH.read_text())
    log.info(f"Loaded {len(transactions)} transactions.")

    agg = aggregate_for_prompt(transactions)
    log.info(
        f"Aggregated: this_month={agg['totals']['this_month']}, "
        f"last_month={agg['totals']['last_month']}, "
        f"subscriptions_detected={len(agg['detected_subscriptions'])}"
    )

    # ── Call Claude (with fallback) ───────────────────────────────────────────
    claude_result = {}
    try:
        prompt = build_user_prompt(agg)
        claude_result = call_claude(prompt)
        log.info("Claude insights generated successfully.")
    except ImportError as e:
        log.warning(f"Anthropic SDK not available: {e}. Using rule-based fallback.")
        claude_result = build_fallback_insights(agg)
    except RuntimeError as e:
        log.warning(f"Claude API not configured: {e}. Using rule-based fallback.")
        claude_result = build_fallback_insights(agg)
    except Exception as e:
        log.error(f"Claude API call failed: {e}. Using rule-based fallback.")
        claude_result = build_fallback_insights(agg)

    # ── Build final insights.json ─────────────────────────────────────────────
    insights = {
        "generated_at": TODAY.isoformat(),
        "alerts": claude_result.get("alerts", [])[:4],
        "subscriptions": agg["detected_subscriptions"],
        "tips": claude_result.get("tips", [])[:5],
        "category_insights": agg["category_summary"],
        "top_merchants": agg["top_merchants"],
    }

    INSIGHTS_PATH.write_text(json.dumps(insights, indent=2, ensure_ascii=False))
    log.info(f"Wrote insights to {INSIGHTS_PATH.name}")
    log.info(f"  Alerts: {len(insights['alerts'])}, Tips: {len(insights['tips'])}, Subscriptions: {len(insights['subscriptions'])}")


if __name__ == "__main__":
    main()
