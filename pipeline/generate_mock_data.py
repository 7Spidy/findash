"""
generate_mock_data.py
─────────────────────
Generates realistic mock financial data for development/testing.
Produces structurally-identical JSON to what the real pipeline will write,
so the frontend works from day one without live Gmail access.

Run:
    python pipeline/generate_mock_data.py
Output:
    data/transactions.json
    data/accounts.json
    data/credit_cards.json
    data/insights.json
    data/last_updated.json
"""

import json
import hashlib
import random
from datetime import date, timedelta
from pathlib import Path

# ─── Seed for reproducibility ────────────────────────────────────────────────
random.seed(42)

DATA_DIR = Path(__file__).parent.parent / "data"
DATA_DIR.mkdir(exist_ok=True)

TODAY = date(2026, 5, 24)
START_DATE = TODAY - timedelta(days=90)

# ─── Merchant catalogue ──────────────────────────────────────────────────────
# Each entry: (merchant_name, category, min_amount, max_amount, weight)
MERCHANTS = [
    # Food & Dining
    ("Swiggy", "Food & Dining", 150, 800, 12),
    ("Zomato", "Food & Dining", 120, 750, 10),
    ("Blinkit", "Food & Dining", 200, 1200, 6),
    ("Starbucks", "Food & Dining", 300, 700, 3),
    ("McDonald's", "Food & Dining", 150, 500, 4),
    ("Zepto", "Food & Dining", 180, 900, 5),
    ("BigBasket", "Food & Dining", 400, 2500, 4),

    # Transport
    ("Uber", "Transport", 80, 600, 8),
    ("Ola", "Transport", 70, 500, 6),
    ("Rapido", "Transport", 40, 250, 5),
    ("BMTC", "Transport", 10, 50, 3),
    ("Indian Railways IRCTC", "Transport", 200, 2500, 2),
    ("IndiGo Airlines", "Transport", 2500, 12000, 1),

    # Shopping
    ("Amazon", "Shopping", 199, 8000, 10),
    ("Flipkart", "Shopping", 299, 6000, 7),
    ("Myntra", "Shopping", 500, 4000, 4),
    ("Meesho", "Shopping", 200, 2000, 3),
    ("Nykaa", "Shopping", 300, 3000, 2),
    ("IKEA", "Shopping", 800, 15000, 1),
    ("Croma", "Shopping", 1000, 40000, 1),

    # Entertainment
    ("BookMyShow", "Entertainment", 200, 1200, 3),
    ("PVR Cinemas", "Entertainment", 300, 1500, 3),
    ("INOX", "Entertainment", 250, 1200, 2),

    # Subscriptions
    ("Netflix", "Subscriptions", 499, 649, 1),
    ("Spotify", "Subscriptions", 59, 119, 1),
    ("Amazon Prime", "Subscriptions", 299, 299, 1),
    ("YouTube Premium", "Subscriptions", 129, 189, 1),
    ("Hotstar", "Subscriptions", 299, 899, 1),
    ("ChatGPT Plus", "Subscriptions", 1699, 1699, 1),
    ("LinkedIn Premium", "Subscriptions", 1699, 2299, 1),

    # Health & Fitness
    ("Apollo Pharmacy", "Health & Fitness", 100, 2000, 4),
    ("MedPlus", "Health & Fitness", 80, 1500, 3),
    ("Cult.fit", "Health & Fitness", 700, 2500, 2),
    ("Dr. Lal Pathlabs", "Health & Fitness", 300, 3000, 1),
    ("Practo", "Health & Fitness", 200, 1000, 1),

    # Utilities
    ("BESCOM", "Utilities", 800, 3000, 1),
    ("Airtel Broadband", "Utilities", 699, 1499, 1),
    ("Jio Mobile", "Utilities", 239, 599, 1),
    ("Airtel Mobile", "Utilities", 299, 599, 1),
    ("LPG Gas Booking", "Utilities", 850, 950, 1),
]

# Build weighted selection list
MERCHANT_POOL = []
for entry in MERCHANTS:
    MERCHANT_POOL.extend([entry] * entry[4])


def pick_merchant():
    return random.choice(MERCHANT_POOL)


# ─── Subscription schedule (fixed monthly charges) ──────────────────────────
SUBSCRIPTIONS = [
    ("Netflix", "Subscriptions", 649, 14),
    ("Spotify", "Subscriptions", 119, 8),
    ("Amazon Prime", "Subscriptions", 299, 3),
    ("YouTube Premium", "Subscriptions", 189, 21),
    ("ChatGPT Plus", "Subscriptions", 1699, 5),
    ("LinkedIn Premium", "Subscriptions", 1699, 18),
    ("Jio Mobile", "Subscriptions", 299, 1),
    ("Airtel Broadband", "Utilities", 999, 22),
    ("BESCOM", "Utilities", 1850, 10),
]


def make_tx_id(date_str: str, account: str, amount: float, description: str) -> str:
    raw = f"{date_str}|{account}|{amount:.2f}|{description}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def random_date_in_range(start: date, end: date) -> date:
    delta = (end - start).days
    return start + timedelta(days=random.randint(0, delta))


# ─── Transaction generators ──────────────────────────────────────────────────

def generate_bank_transactions() -> list[dict]:
    """Generate 90 days of HDFC + ICICI debit/credit transactions."""
    transactions = []

    accounts = ["HDFC", "ICICI"]
    # Each account gets a salary credit on ~1st of the month
    salary_amounts = {"HDFC": 85000, "ICICI": 0}  # HDFC is primary salary account

    current = START_DATE
    while current <= TODAY:
        # Salary on 1st
        if current.day == 1:
            tx_date = current.strftime("%Y-%m-%d")
            amt = salary_amounts["HDFC"]
            desc = "NEFT CR - EMPLOYER PAYROLL"
            transactions.append({
                "id": make_tx_id(tx_date, "HDFC", amt, desc),
                "date": tx_date,
                "amount": float(amt),
                "type": "credit",
                "account": "HDFC",
                "description": desc,
                "merchant": "Employer",
                "category": "Transfers",
                "raw_source": "bank_statement",
                "currency": "INR",
            })
            # Transfer part to ICICI for credit card bills
            transfer_amt = 30000.0
            desc2 = "NEFT DR - SELF TRANSFER ICICI"
            transactions.append({
                "id": make_tx_id(tx_date, "HDFC", transfer_amt, desc2),
                "date": tx_date,
                "amount": transfer_amt,
                "type": "debit",
                "account": "HDFC",
                "description": desc2,
                "merchant": "Self Transfer",
                "category": "Transfers",
                "raw_source": "bank_statement",
                "currency": "INR",
            })
            # Credit side on ICICI
            desc3 = "NEFT CR - SELF TRANSFER HDFC"
            transactions.append({
                "id": make_tx_id(tx_date, "ICICI", transfer_amt, desc3),
                "date": tx_date,
                "amount": transfer_amt,
                "type": "credit",
                "account": "ICICI",
                "description": desc3,
                "merchant": "Self Transfer",
                "category": "Transfers",
                "raw_source": "bank_statement",
                "currency": "INR",
            })

        # Subscriptions (fixed day each month)
        for sub_name, sub_cat, sub_amt, sub_day in SUBSCRIPTIONS:
            if current.day == sub_day:
                acct = "HDFC" if random.random() < 0.6 else "ICICI"
                tx_date = current.strftime("%Y-%m-%d")
                desc = f"UPI-{sub_name.replace(' ', '').upper()}-AUTOPAY"
                transactions.append({
                    "id": make_tx_id(tx_date, acct, float(sub_amt), desc),
                    "date": tx_date,
                    "amount": float(sub_amt),
                    "type": "debit",
                    "account": acct,
                    "description": desc,
                    "merchant": sub_name,
                    "category": sub_cat,
                    "raw_source": "email_alert",
                    "currency": "INR",
                })

        # Random daily spends (2–6 per day across both accounts)
        n_spends = random.randint(2, 6)
        for _ in range(n_spends):
            m_name, m_cat, m_min, m_max, _ = pick_merchant()
            # Skip subscriptions here (handled above)
            if m_cat == "Subscriptions":
                continue
            amt = round(random.uniform(m_min, m_max), 2)
            acct = random.choice(accounts)
            raw_src = random.choice(["email_alert", "sms_forward", "bank_statement"])
            tx_date = current.strftime("%Y-%m-%d")
            desc = f"UPI-{m_name.upper().replace(' ', '-')[:20]}"
            transactions.append({
                "id": make_tx_id(tx_date, acct, amt, desc),
                "date": tx_date,
                "amount": amt,
                "type": "debit",
                "account": acct,
                "description": desc,
                "merchant": m_name,
                "category": m_cat,
                "raw_source": raw_src,
                "currency": "INR",
            })

        # Occasional ATM withdrawal (once a week-ish)
        if random.random() < 0.14:
            amt = float(random.choice([2000, 3000, 5000, 10000]))
            acct = "HDFC"
            tx_date = current.strftime("%Y-%m-%d")
            desc = "ATM WDL - HDFC KORAMANGALA"
            transactions.append({
                "id": make_tx_id(tx_date, acct, amt, desc),
                "date": tx_date,
                "amount": amt,
                "type": "debit",
                "account": acct,
                "description": desc,
                "merchant": "ATM",
                "category": "Others",
                "raw_source": "sms_forward",
                "currency": "INR",
            })

        current += timedelta(days=1)

    return transactions


def generate_cc_transactions() -> list[dict]:
    """Generate 2 months of SBI and ICICI credit card transactions."""
    transactions = []
    cc_accounts = ["SBI_CC", "ICICI_CC"]
    cc_start = TODAY - timedelta(days=60)

    current = cc_start
    while current <= TODAY:
        n_spends = random.randint(1, 4)
        for _ in range(n_spends):
            m_name, m_cat, m_min, m_max, _ = pick_merchant()
            if m_cat in ("Subscriptions", "Transfers", "Utilities"):
                continue
            amt = round(random.uniform(m_min, m_max), 2)
            cc = random.choice(cc_accounts)
            tx_date = current.strftime("%Y-%m-%d")
            desc = f"POS-{m_name.upper().replace(' ', '-')[:20]}"
            transactions.append({
                "id": make_tx_id(tx_date, cc, amt, desc),
                "date": tx_date,
                "amount": amt,
                "type": "debit",
                "account": cc,
                "description": desc,
                "merchant": m_name,
                "category": m_cat,
                "raw_source": "cc_statement",
                "currency": "INR",
            })

        # Subscriptions charged to SBI_CC
        for sub_name, sub_cat, sub_amt, sub_day in SUBSCRIPTIONS[:4]:
            if current.day == sub_day:
                tx_date = current.strftime("%Y-%m-%d")
                desc = f"POS-{sub_name.upper().replace(' ', '-')}-SUBSCRIPTION"
                transactions.append({
                    "id": make_tx_id(tx_date, "SBI_CC", float(sub_amt), desc),
                    "date": tx_date,
                    "amount": float(sub_amt),
                    "type": "debit",
                    "account": "SBI_CC",
                    "description": desc,
                    "merchant": sub_name,
                    "category": sub_cat,
                    "raw_source": "cc_statement",
                    "currency": "INR",
                })
        current += timedelta(days=1)

    return transactions


# ─── Build account summaries ─────────────────────────────────────────────────

def build_accounts_summary(transactions: list[dict]) -> dict:
    this_month = TODAY.strftime("%Y-%m")
    last_month = (TODAY.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")

    summaries = {}
    for acct in ["HDFC", "ICICI"]:
        monthly_flow: dict[str, dict] = {}
        for tx in transactions:
            if tx["account"] != acct:
                continue
            month = tx["date"][:7]
            if month not in monthly_flow:
                monthly_flow[month] = {"credit": 0.0, "debit": 0.0}
            if tx["type"] == "credit":
                monthly_flow[month]["credit"] += tx["amount"]
            else:
                monthly_flow[month]["debit"] += tx["amount"]

        months_sorted = sorted(monthly_flow.keys())[-6:]
        flow_list = [
            {
                "month": m,
                "credit": round(monthly_flow[m]["credit"], 2),
                "debit": round(monthly_flow[m]["debit"], 2),
                "net": round(monthly_flow[m]["credit"] - monthly_flow[m]["debit"], 2),
            }
            for m in months_sorted
        ]

        def month_total(month_str: str, tx_type: str) -> float:
            return round(sum(
                t["amount"] for t in transactions
                if t["account"] == acct
                and t["date"][:7] == month_str
                and t["type"] == tx_type
            ), 2)

        # Use fixed realistic balances (real pipeline will pull from latest statement)
        running_balance = 142650.0 if acct == "HDFC" else 38420.0

        recent_ids = [
            t["id"] for t in sorted(transactions, key=lambda x: x["date"], reverse=True)
            if t["account"] == acct
        ][:10]

        summaries[acct] = {
            "id": acct,
            "name": f"{'HDFC' if acct == 'HDFC' else 'ICICI'} Savings Account",
            "balance": running_balance,
            "as_of": TODAY.isoformat(),
            "this_month_credit": month_total(this_month, "credit"),
            "this_month_debit": month_total(this_month, "debit"),
            "last_month_credit": month_total(last_month, "credit"),
            "last_month_debit": month_total(last_month, "debit"),
            "monthly_flow": flow_list,
            "recent_transactions": recent_ids,
        }

    return {
        "accounts": list(summaries.values()),
        "last_updated": TODAY.isoformat(),
    }


# ─── Build credit card summaries ─────────────────────────────────────────────

def build_cc_summary(cc_transactions: list[dict]) -> dict:
    cards_meta = {
        "SBI_CC": {
            "name": "SBI SimplyCLICK Credit Card",
            "bank": "SBI",
            "credit_limit": 200000,
            "due_date": (TODAY + timedelta(days=12)).isoformat(),
            "statement_date": (TODAY - timedelta(days=18)).isoformat(),
        },
        "ICICI_CC": {
            "name": "ICICI Amazon Pay Credit Card",
            "bank": "ICICI",
            "credit_limit": 150000,
            "due_date": (TODAY + timedelta(days=7)).isoformat(),
            "statement_date": (TODAY - timedelta(days=23)).isoformat(),
        },
    }

    this_month = TODAY.strftime("%Y-%m")
    last_month = (TODAY.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")

    cards = []
    for cc_id, meta in cards_meta.items():
        this_cycle = round(sum(
            t["amount"] for t in cc_transactions
            if t["account"] == cc_id and t["date"][:7] == this_month
        ), 2)
        last_cycle = round(sum(
            t["amount"] for t in cc_transactions
            if t["account"] == cc_id and t["date"][:7] == last_month
        ), 2)
        utilization = round((this_cycle / meta["credit_limit"]) * 100, 1)
        min_due = round(this_cycle * 0.05, 2)

        monthly_spend = []
        for months_back in range(5, -1, -1):
            ref = TODAY.replace(day=1) - timedelta(days=months_back * 28)
            m = ref.strftime("%Y-%m")
            spend = round(sum(
                t["amount"] for t in cc_transactions
                if t["account"] == cc_id and t["date"][:7] == m
            ), 2)
            monthly_spend.append({"month": m, "credit": 0.0, "debit": spend, "net": -spend})

        cards.append({
            "id": cc_id,
            "name": meta["name"],
            "bank": meta["bank"],
            "credit_limit": meta["credit_limit"],
            "outstanding": this_cycle,
            "minimum_due": min_due,
            "total_due": this_cycle,
            "due_date": meta["due_date"],
            "statement_date": meta["statement_date"],
            "this_cycle_spend": this_cycle,
            "last_cycle_spend": last_cycle,
            "utilization_pct": utilization,
            "monthly_spend": monthly_spend,
        })

    return {"cards": cards, "last_updated": TODAY.isoformat()}


# ─── Build insights ───────────────────────────────────────────────────────────

def build_insights(all_transactions: list[dict]) -> dict:
    this_month = TODAY.strftime("%Y-%m")
    last_month = (TODAY.replace(day=1) - timedelta(days=1)).strftime("%Y-%m")

    categories = [
        "Food & Dining", "Transport", "Shopping", "Entertainment",
        "Health & Fitness", "Subscriptions", "Utilities", "Transfers", "Others",
    ]

    def cat_total(month: str, cat: str) -> float:
        return round(sum(
            t["amount"] for t in all_transactions
            if t["date"][:7] == month and t["category"] == cat and t["type"] == "debit"
        ), 2)

    two_months_ago = (TODAY.replace(day=1) - timedelta(days=45)).strftime("%Y-%m")

    category_insights = []
    for cat in categories:
        tm = cat_total(this_month, cat)
        lm = cat_total(last_month, cat)
        avg = round((tm + lm + cat_total(two_months_ago, cat)) / 3, 2)
        change_pct = round(((tm - lm) / lm * 100) if lm > 0 else 0, 1)
        category_insights.append({
            "category": cat,
            "this_month": tm,
            "last_month": lm,
            "avg_3m": avg,
            "change_pct": change_pct,
        })

    # Merchant aggregation
    merchant_totals: dict[str, dict] = {}
    for t in all_transactions:
        if t["type"] != "debit":
            continue
        m = t["merchant"]
        if m not in merchant_totals:
            merchant_totals[m] = {"total": 0.0, "count": 0}
        merchant_totals[m]["total"] += t["amount"]
        merchant_totals[m]["count"] += 1

    top_merchants = sorted(
        [{"merchant": k, "total": round(v["total"], 2), "count": v["count"]} for k, v in merchant_totals.items()],
        key=lambda x: x["total"],
        reverse=True,
    )[:15]

    return {
        "generated_at": TODAY.isoformat(),
        "alerts": [
            {
                "type": "unused_subscription",
                "title": "LinkedIn Premium — Are you using it?",
                "description": "You've been charged ₹1,699/month for LinkedIn Premium for 3 months but show no usage pattern.",
                "estimated_saving": 1699,
            },
            {
                "type": "spike",
                "title": "Food & Dining up 34% this month",
                "description": "You've spent ₹8,200 on food this month vs ₹6,100 last month. Swiggy and Zomato account for 80% of this.",
                "estimated_saving": 2000,
            },
            {
                "type": "duplicate",
                "title": "Possible duplicate streaming subscriptions",
                "description": "You pay for Netflix (₹649), Hotstar (₹299), and YouTube Premium (₹189) — consider consolidating.",
                "estimated_saving": 488,
            },
        ],
        "subscriptions": [
            {"name": "Netflix", "amount": 649, "frequency": "monthly", "last_charged": (TODAY - timedelta(days=10)).isoformat(), "category": "Subscriptions"},
            {"name": "Spotify", "amount": 119, "frequency": "monthly", "last_charged": (TODAY - timedelta(days=16)).isoformat(), "category": "Subscriptions"},
            {"name": "Amazon Prime", "amount": 299, "frequency": "monthly", "last_charged": (TODAY - timedelta(days=21)).isoformat(), "category": "Subscriptions"},
            {"name": "YouTube Premium", "amount": 189, "frequency": "monthly", "last_charged": (TODAY - timedelta(days=3)).isoformat(), "category": "Subscriptions"},
            {"name": "ChatGPT Plus", "amount": 1699, "frequency": "monthly", "last_charged": (TODAY - timedelta(days=19)).isoformat(), "category": "Subscriptions"},
            {"name": "LinkedIn Premium", "amount": 1699, "frequency": "monthly", "last_charged": (TODAY - timedelta(days=6)).isoformat(), "category": "Subscriptions"},
            {"name": "Jio Mobile", "amount": 299, "frequency": "monthly", "last_charged": (TODAY - timedelta(days=23)).isoformat(), "category": "Subscriptions"},
            {"name": "Airtel Broadband", "amount": 999, "frequency": "monthly", "last_charged": (TODAY - timedelta(days=2)).isoformat(), "category": "Utilities"},
        ],
        "tips": [
            "Switch from Swiggy to cooking 3 days a week — potential saving of ₹1,500/month.",
            "Cancel LinkedIn Premium if not actively job-hunting — saves ₹20,388/year.",
            "You consistently spend more on weekends. Set a ₹1,000/day weekend cap.",
            "Your ICICI CC bill is due in 7 days — autopay setup recommended to avoid late fees.",
            "BESCOM bill averages ₹1,850/month. Switching AC to 24°C can save ~₹400/month.",
        ],
        "category_insights": category_insights,
        "top_merchants": top_merchants,
    }


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    print("Generating mock transaction data...")

    bank_txns = generate_bank_transactions()
    cc_txns = generate_cc_transactions()
    all_txns = bank_txns + cc_txns

    # Deduplicate by ID (shouldn't happen with mock data, but mirrors real pipeline)
    seen = set()
    unique_txns = []
    for t in all_txns:
        if t["id"] not in seen:
            seen.add(t["id"])
            unique_txns.append(t)

    # Sort by date descending
    unique_txns.sort(key=lambda x: x["date"], reverse=True)

    # Write transactions.json
    txn_path = DATA_DIR / "transactions.json"
    txn_path.write_text(json.dumps(unique_txns, indent=2, ensure_ascii=False))
    print(f"  OK transactions.json -- {len(unique_txns)} transactions")

    # Write accounts.json
    accounts_data = build_accounts_summary(bank_txns)
    (DATA_DIR / "accounts.json").write_text(json.dumps(accounts_data, indent=2))
    print("  OK accounts.json")

    # Write credit_cards.json
    cc_data = build_cc_summary(cc_txns)
    (DATA_DIR / "credit_cards.json").write_text(json.dumps(cc_data, indent=2))
    print("  OK credit_cards.json")

    # Write insights.json
    insights = build_insights(unique_txns)
    (DATA_DIR / "insights.json").write_text(json.dumps(insights, indent=2))
    print("  OK insights.json")

    # Write last_updated.json
    last_updated = {
        "timestamp": TODAY.isoformat() + "T06:30:00+05:30",
        "emails_fetched": 0,
        "transactions_added": len(unique_txns),
        "parse_errors": 0,
        "pipeline_version": "1.0.0-mock",
    }
    (DATA_DIR / "last_updated.json").write_text(json.dumps(last_updated, indent=2))
    print("  OK last_updated.json")

    print(f"\nDone. {len(unique_txns)} transactions across HDFC, ICICI, SBI_CC, ICICI_CC.")
    print(f"Date range: {unique_txns[-1]['date']} to {unique_txns[0]['date']}")


if __name__ == "__main__":
    main()
