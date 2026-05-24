"""
categoriser.py
──────────────
Keyword-based transaction categorisation engine.
Maps merchant names and description strings to spending categories.

Usage:
    from categoriser import categorise, extract_merchant

The categoriser is intentionally simple and fast — no ML, no network calls.
It works on both email alert descriptions and PDF-parsed merchant names.
"""

import re
from typing import Optional

# ─── Category keyword rules ────────────────────────────────────────────────────
# Rules are evaluated in order; first match wins.
# Each rule: (category, list_of_keywords_or_patterns)
# Keywords are matched case-insensitively against the full description string.

CATEGORY_RULES: list[tuple[str, list[str]]] = [
    ("Food & Dining", [
        "swiggy", "zomato", "blinkit", "zepto", "bigbasket", "grofers",
        "dunzo", "starbucks", "mcdonalds", "mcdonald", "dominos", "domino",
        "pizza hut", "kfc", "subway", "burger king", "haldiram", "restaurant",
        "cafe", "dhaba", "hotel food", "food court", "chaayos", "barista",
        "instamart", "quick commerce", "fresh menu", "rebel foods",
        "box8", "faasos", "behrouz", "oven story",
    ]),
    ("Transport", [
        "uber", "ola cabs", "ola ", "rapido", "bluestar", "meru",
        "bmtc", "metro", "dmrc", "railways", "irctc", "indian rail",
        "indigo", "air india", "spicejet", "vistara", "go first", "akasa",
        "redbus", "abhi bus", "yatra", "makemytrip", "goibibo",
        "petrol", "fuel", "hp petro", "indian oil", "bpcl", "shell",
        "fasttag", "toll", "parking",
    ]),
    ("Shopping", [
        "amazon", "flipkart", "myntra", "meesho", "ajio", "nykaa",
        "tatacliq", "snapdeal", "shopsy", "reliance digital", "croma",
        "ikea", "h&m", "zara", "lifestyle", "pantaloons", "max fashion",
        "decathlon", "nike", "adidas", "puma", "woodland", "bata",
        "firstcry", "hopscotch", "shopclues",
    ]),
    ("Entertainment", [
        "bookmyshow", "pvr", "inox", "cinepolis", "movietime",
        "steam", "playstation", "xbox", "apple games", "google play",
        "escape room", "fun world", "laser tag", "bowling",
    ]),
    ("Subscriptions", [
        "netflix", "hotstar", "disneyplus", "disney+", "amazon prime",
        "spotify", "gaana", "wynk", "jiosaavn", "apple music",
        "youtube premium", "youtube music",
        "chatgpt", "openai", "anthropic",
        "linkedin premium", "linkedin",
        "microsoft 365", "office 365", "google workspace", "gsuite",
        "dropbox", "icloud", "google one",
        "zoom", "notion", "slack", "figma", "canva",
        "grammarly", "duolingo",
    ]),
    ("Health & Fitness", [
        "apollo pharmacy", "medplus", "1mg", "pharmeasy", "netmeds",
        "tata health", "practo", "fortis", "manipal hospital",
        "columbia asia", "narayana", "sagar hospitals",
        "cult fit", "cult.fit", "gold gym", "anytime fitness",
        "lal pathlabs", "thyrocare", "dr reddy",
        "pharmacy", "medical", "clinic", "hospital", "health",
    ]),
    ("Utilities", [
        "bescom", "electricity", "water board", "bwssb",
        "airtel", "jio", "vodafone", "vi mobile", "bsnl",
        "broadband", "fiber", "recharge",
        "gas", "lpg", "indane", "hp gas", "bharat gas",
        "property tax", "municipal", "bbmp",
    ]),
    ("Transfers", [
        "neft", "imps", "rtgs", "upi transfer", "self transfer",
        "salary", "payroll", "stipend", "reimbursement",
        "atm wdl", "atm withdrawal", "cash deposit",
        "fd", "fixed deposit", "rd", "recurring deposit",
        "mutual fund", "sip", "zerodha", "groww", "upstox", "angel",
    ]),
]

# Catch-all
DEFAULT_CATEGORY = "Others"


def categorise(description: str, merchant: Optional[str] = None) -> str:
    """
    Return a spending category for the given transaction description/merchant.

    Tries merchant name first (more precise), then falls back to full description.
    Returns DEFAULT_CATEGORY if no rule matches.
    """
    search_text = f"{merchant or ''} {description}".lower().strip()

    for category, keywords in CATEGORY_RULES:
        for kw in keywords:
            if kw in search_text:
                return category

    return DEFAULT_CATEGORY


# ─── Merchant name extraction ─────────────────────────────────────────────────

# Patterns to strip from bank descriptions before treating as merchant name
_STRIP_PREFIXES = re.compile(
    r"^(upi[-/]?|pos[-/]?|neft[-/]?|imps[-/]?|atm[-/]?|inf[-/]?|bft[-/]?|"
    r"trf to |trf frm |payment to |purchase at |purchase-|paid to |"
    r"debit card swipe[-/]?)",
    re.IGNORECASE,
)

_STRIP_SUFFIXES = re.compile(
    r"([-/]\d{6,}|[-/]ref[\w]+|[-/]txn[\w]+|\s+\d{10,}|\s*autopay|\s*subscription)$",
    re.IGNORECASE,
)

_CLEAN_SEPARATORS = re.compile(r"[-_]+")


def extract_merchant(description: str) -> str:
    """
    Extract a human-readable merchant name from a raw bank transaction description.

    Examples:
        "UPI-SWIGGY-FOOD" -> "Swiggy Food"
        "POS-AMAZON-IN-12345678" -> "Amazon In"
        "NEFT CR - SALARY CORP" -> "Salary Corp"
    """
    name = description.strip()

    # Remove common prefixes
    name = _STRIP_PREFIXES.sub("", name).strip()

    # Remove trailing reference numbers and keywords
    name = _STRIP_SUFFIXES.sub("", name).strip()

    # Replace dash/underscore separators with spaces
    name = _CLEAN_SEPARATORS.sub(" ", name).strip()

    # Title-case
    name = name.title()

    # Truncate to reasonable length
    return name[:40] if name else "Unknown"


# ─── Amount/currency extraction helpers ──────────────────────────────────────

_AMOUNT_PATTERN = re.compile(
    r"(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)",
    re.IGNORECASE,
)

_AMOUNT_BARE = re.compile(
    r"\b([\d,]{1,10}\.\d{2})\b"
)


def extract_amount(text: str) -> Optional[float]:
    """
    Extract the first INR amount from a string.

    Handles: "Rs. 1,250.00", "INR 500", "₹ 1200.50", "debited by 750.00"
    """
    m = _AMOUNT_PATTERN.search(text)
    if m:
        return float(m.group(1).replace(",", ""))

    # Fallback: find a bare decimal number that looks like money
    m = _AMOUNT_BARE.search(text)
    if m:
        return float(m.group(1).replace(",", ""))

    return None


# ─── Date extraction helper ───────────────────────────────────────────────────

_MONTH_MAP = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04",
    "may": "05", "jun": "06", "jul": "07", "aug": "08",
    "sep": "09", "oct": "10", "nov": "11", "dec": "12",
}

# Ordered from most-specific to least-specific to avoid short patterns swallowing
# part of a longer date string.
_DATE_PATTERNS = [
    # DD/MM/YYYY or DD-MM-YYYY  (4-digit year)  e.g. "12-05-2026"
    ("dmy4",  re.compile(r"\b(\d{2})[/-](\d{2})[/-](\d{4})\b")),
    # YYYY-MM-DD  (ISO)  e.g. "2026-05-12"
    ("iso",   re.compile(r"\b(\d{4})[/-](\d{2})[/-](\d{2})\b")),
    # DD Mon YYYY  e.g. "14 May 2026"  (legacy style used by some HDFC/ICICI emails)
    ("dmy4m", re.compile(r"\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{4})\b", re.I)),
    # Mon DD, YYYY  e.g. "May 24, 2026"  (ICICI CC / savings NEFT format)
    ("mdy4",  re.compile(r"\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2}),?\s+(\d{4})\b", re.I)),
    # DD-Mon-YYYY or DD-Mon-YY  e.g. "29-Apr-2026", "29-Apr-26"  (ICICI ATM / CC payment)
    ("dmym",  re.compile(r"\b(\d{1,2})-(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*-(\d{2,4})\b", re.I)),
    # DD/MM/YY or DD-MM-YY  (2-digit year → 20xx)  e.g. "24-05-26", "23/05/26"
    # NOTE: must come AFTER 4-digit patterns to avoid matching the last two digits of YYYY.
    ("dmy2",  re.compile(r"\b(\d{2})[/-](\d{2})[/-](\d{2})\b")),
]


def extract_date(text: str) -> Optional[str]:
    """
    Extract and normalise a date string from raw text to YYYY-MM-DD.
    Handles all date formats used by Indian bank alert emails:
      DD-MM-YYYY, YYYY-MM-DD, DD Mon YYYY, Mon DD YYYY, DD-Mon-YY, DD/MM/YY.
    Returns None if no date found.
    """
    if not text:
        return None

    for kind, pat in _DATE_PATTERNS:
        m = pat.search(text)
        if not m:
            continue

        if kind == "dmy4":
            dd, mm, yyyy = m.group(1), m.group(2), m.group(3)
            return f"{yyyy}-{mm}-{dd}"

        if kind == "iso":
            return m.group(0).replace("/", "-")

        if kind == "dmy4m":
            dd = m.group(1).zfill(2)
            mm = _MONTH_MAP[m.group(2).lower()[:3]]
            yyyy = m.group(3)
            return f"{yyyy}-{mm}-{dd}"

        if kind == "mdy4":
            mm = _MONTH_MAP[m.group(1).lower()[:3]]
            dd = m.group(2).zfill(2)
            yyyy = m.group(3)
            return f"{yyyy}-{mm}-{dd}"

        if kind == "dmym":
            dd = m.group(1).zfill(2)
            mm = _MONTH_MAP[m.group(2).lower()[:3]]
            yr = m.group(3)
            yyyy = f"20{yr}" if len(yr) == 2 else yr
            return f"{yyyy}-{mm}-{dd}"

        if kind == "dmy2":
            dd, mo, yy = m.group(1), m.group(2), m.group(3)
            yyyy = f"20{yy}"
            return f"{yyyy}-{mo}-{dd}"

    return None


# ─── Quick self-test ──────────────────────────────────────────────────────────

if __name__ == "__main__":
    tests = [
        ("UPI-SWIGGY-FOOD-98765", None, "Food & Dining"),
        ("POS-NETFLIX-SUBSCRIPTION", None, "Subscriptions"),
        ("NEFT CR - EMPLOYER PAYROLL", None, "Transfers"),
        ("ATM WDL - HDFC KORAMANGALA", None, "Transfers"),
        ("UPI-APOLLO-PHARMACY", None, "Health & Fitness"),
        ("POS-AMAZON-IN-12345", None, "Shopping"),
        ("IRCTC TRAIN BOOKING", None, "Transport"),
        ("RANDOM UNKNOWN VENDOR", None, "Others"),
    ]

    all_pass = True
    for desc, merch, expected in tests:
        result = categorise(desc, merch)
        status = "PASS" if result == expected else "FAIL"
        if status == "FAIL":
            all_pass = False
        print(f"  [{status}] '{desc}' -> {result} (expected {expected})")

    print()
    print("extract_merchant tests:")
    for desc in ["UPI-SWIGGY-FOOD-DELIVERY", "POS-AMAZON-IN-PURCHASE-1234567890", "NEFT CR - SALARY CORP LTD"]:
        print(f"  '{desc}' -> '{extract_merchant(desc)}'")

    print()
    print("extract_amount tests:")
    for text in ["Rs. 1,250.00 debited", "INR 500 credited", "amount: 750.50", "no amount here"]:
        print(f"  '{text}' -> {extract_amount(text)}")

    print()
    print("extract_date tests:")
    for text in ["on 14/05/2026 at 10:30", "2026-05-24 transaction", "dated 03 Mar 2026", "no date"]:
        print(f"  '{text}' -> {extract_date(text)}")

    print()
    print("All categoriser tests passed." if all_pass else "Some tests FAILED.")
