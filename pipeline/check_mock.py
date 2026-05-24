import json

txns = json.loads(open("data/transactions.json").read())
accounts = json.loads(open("data/accounts.json").read())
cards = json.loads(open("data/credit_cards.json").read())
insights = json.loads(open("data/insights.json").read())

print("TRANSACTIONS sample (first 2):")
for t in txns[:2]:
    print(" ", t)

print()
print("ACCOUNTS:")
for a in accounts["accounts"]:
    print(" ", a["name"], "| balance:", a["balance"], "| in:", a["this_month_credit"], "| out:", a["this_month_debit"])

print()
print("CREDIT CARDS:")
for c in cards["cards"]:
    print(" ", c["name"], "| spend:", c["this_cycle_spend"], "| util:", c["utilization_pct"], "% | due:", c["due_date"])

print()
print("INSIGHTS alerts:", len(insights["alerts"]))
print("INSIGHTS subscriptions:", len(insights["subscriptions"]))
print("INSIGHTS top merchants:", insights["top_merchants"][:3])
