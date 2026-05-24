"""
parse_transactions.py
─────────────────────
Parses fetched emails and PDFs into structured Transaction objects,
deduplicates against existing data, and writes transactions.json.

Parsing strategy:
  1. Alert emails (HDFC / ICICI debit/credit SMS-style notifications)
  2. SMS-forwarded emails (forwarded from phone, same regex patterns)
  3. Bank statement PDFs (tabular extraction via pdfplumber)
  4. Credit card statement PDFs (itemised charges via pdfplumber)

On any parse failure, the raw email is logged to /data/parse_errors.json
and processing continues — the pipeline never crashes on bad input.

Run standalone (processes pending_emails.json + any PDFs in /tmp/findash_pdfs/):
    python pipeline/parse_transactions.py
"""

import hashlib
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from categoriser import categorise, extract_merchant, extract_amount, extract_date

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
RAW_DIR = DATA_DIR / "raw"
TMP_PDF_DIR = Path(os.environ.get("TEMP", "/tmp")) / "findash_pdfs"

TRANSACTIONS_PATH = DATA_DIR / "transactions.json"
PARSE_ERRORS_PATH = DATA_DIR / "parse_errors.json"
PENDING_EMAILS_PATH = RAW_DIR / "pending_emails.json"

# ─── PDF passwords (set as GitHub Actions secrets) ────────────────────────────
ICICI_CC_PDF_PASSWORD = os.environ.get("ICICI_CC_PDF_PASSWORD", "")
SBI_CC_PDF_PASSWORD   = os.environ.get("SBI_CC_PDF_PASSWORD", "")


# ─── Transaction builder ──────────────────────────────────────────────────────

def make_transaction_id(date_str: str, account: str, amount: float, description: str) -> str:
    """SHA-256 hash of key fields; first 16 hex chars = unique-enough ID."""
    raw = f"{date_str}|{account}|{amount:.2f}|{description[:40]}"
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


def build_transaction(
    date_str: str,
    amount: float,
    tx_type: str,
    account: str,
    description: str,
    raw_source: str,
    merchant: Optional[str] = None,
) -> dict:
    """
    Construct a fully-populated transaction dict.
    Merchant and category are inferred if not provided.
    """
    merchant = merchant or extract_merchant(description)
    category = categorise(description, merchant)
    tx_id = make_transaction_id(date_str, account, amount, description)

    return {
        "id": tx_id,
        "date": date_str,
        "amount": round(float(amount), 2),
        "type": tx_type,
        "account": account,
        "description": description.strip()[:100],
        "merchant": merchant[:40],
        "category": category,
        "raw_source": raw_source,
        "currency": "INR",
    }


# ─── Alert email parsers ──────────────────────────────────────────────────────
# HDFC alert format example:
#   "Rs.1,250.00 debited from a/c **1234 on 14-05-26. Info: UPI-SWIGGY"
#   "Rs 500.00 credited to a/c **5678 on 14/05/2026. Info: NEFT-EMPLOYER"

_HDFC_DEBIT = re.compile(
    r"(?:Rs\.?\s*|INR\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)\s*(?:has been\s*)?(?:debited|deducted)"
    r".*?(?:a/?c\s*[*xX]*(\d{4}))?"
    r".*?(?:on\s+(\d{2}[/-]\d{2}[/-]\d{2,4}))?"
    r".*?(?:Info:\s*(.+))?$",
    re.IGNORECASE | re.DOTALL,
)

_HDFC_CREDIT = re.compile(
    r"(?:Rs\.?\s*|INR\s*|₹\s*)([\d,]+(?:\.\d{1,2})?)\s*(?:has been\s*)?credited"
    r".*?(?:a/?c\s*[*xX]*(\d{4}))?"
    r".*?(?:on\s+(\d{2}[/-]\d{2}[/-]\d{2,4}))?"
    r".*?(?:Info:\s*(.+))?$",
    re.IGNORECASE | re.DOTALL,
)

# ICICI alert format example:
#   "Dear Customer, INR 2,000.00 debited from a/c XX1234 on 14-May-26.
#    Info: UPI/AMAZON. Avl Bal: INR 45,000.00"

_ICICI_DEBIT = re.compile(
    r"(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*debited\s+from\s+(?:a/?c|Acct)\s*[xX*]*(\d{4})"
    r".*?on\s+(\d{2}[-/]\w{3}[-/]\d{2,4}|\d{2}[-/]\d{2}[-/]\d{2,4})"
    r".*?Info:\s*([^\n.]+)",
    re.IGNORECASE | re.DOTALL,
)

_ICICI_CREDIT = re.compile(
    r"(?:INR|Rs\.?|₹)\s*([\d,]+(?:\.\d{1,2})?)\s*credited\s+(?:to\s+)?(?:a/?c|Acct)\s*[xX*]*(\d{4})"
    r".*?on\s+(\d{2}[-/]\w{3}[-/]\d{2,4}|\d{2}[-/]\d{2}[-/]\d{2,4})"
    r".*?Info:\s*([^\n.]+)",
    re.IGNORECASE | re.DOTALL,
)


def parse_alert_email(email: dict) -> list[dict]:
    """
    Parse an HDFC or ICICI transaction alert email into Transaction dicts.
    Handles both debit and credit alerts in both SMS-style and HTML formats.
    Returns list of parsed transactions (usually 1, occasionally 0).
    """
    transactions = []
    sender = email.get("from", "").lower()
    snippet = email.get("snippet", "")

    # Collect all plain-text parts
    text_parts = []
    for part in email.get("parts", []):
        if part.get("mime") == "text/plain":
            text_parts.append(part.get("text", ""))

    full_text = snippet + " " + " ".join(text_parts)
    full_text = " ".join(full_text.split())  # normalise whitespace

    # Determine account from sender.
    # Note: matches both legacy domains (icicibank.com) and the new
    # RBI-mandated .bank.in domains (hdfcbank.bank.in, icici.bank.in).
    if "hdfc" in sender:
        account = "HDFC"
        debit_pat, credit_pat = _HDFC_DEBIT, _HDFC_CREDIT
    elif "icici" in sender and "credit" not in sender and "cc" not in sender:
        account = "ICICI"
        debit_pat, credit_pat = _ICICI_DEBIT, _ICICI_CREDIT
    elif "icici" in sender:
        account = "ICICI_CC"
        debit_pat, credit_pat = _ICICI_DEBIT, _ICICI_CREDIT
    elif "sbicard" in sender or "sbi" in sender:
        account = "SBI_CC"
        debit_pat, credit_pat = _HDFC_DEBIT, _HDFC_CREDIT
    else:
        return []  # Unknown sender — skip

    def try_parse(pattern, tx_type: str) -> Optional[dict]:
        m = pattern.search(full_text)
        if not m:
            return None
        try:
            amount = float(m.group(1).replace(",", ""))
            date_raw = m.group(3) if m.lastindex >= 3 else ""
            date_str = extract_date(date_raw) if date_raw else datetime.now().strftime("%Y-%m-%d")
            description = (m.group(4) if m.lastindex >= 4 else "").strip() or email.get("subject", "")
            return build_transaction(date_str, amount, tx_type, account, description, "email_alert")
        except Exception as e:
            log.debug(f"Alert parse sub-error: {e}")
            return None

    debit_tx = try_parse(debit_pat, "debit")
    if debit_tx:
        transactions.append(debit_tx)

    credit_tx = try_parse(credit_pat, "credit")
    if credit_tx:
        transactions.append(credit_tx)

    return transactions


# ─── SMS forward parser ───────────────────────────────────────────────────────
# Forwarded SMS emails typically contain the raw SMS text in the body.
# The SMS format varies by bank but usually matches the alert patterns above.
# We detect SMS-forwards by subject keywords and route accordingly.

SMS_FORWARD_SUBJECTS = re.compile(
    r"(fwd|forward|sms|txn alert|transaction alert)",
    re.IGNORECASE,
)


def parse_sms_forward(email: dict) -> list[dict]:
    """
    Parse an SMS-forwarded email.
    Reuses alert parsing logic; only the raw_source tag differs.
    """
    txns = parse_alert_email(email)
    for t in txns:
        t["raw_source"] = "sms_forward"
    return txns


# ─── PDF bank statement parser ────────────────────────────────────────────────

def parse_bank_statement_pdf(pdf_path: Path, account: str) -> list[dict]:
    """
    Parse a bank PDF statement using pdfplumber.
    Extracts tabular rows and maps them to Transaction dicts.

    Column heuristics (HDFC/ICICI statements typically use):
        Date | Narration/Description | Chq/Ref | Withdrawal(Dr) | Deposit(Cr) | Balance

    Returns list of parsed transactions.
    """
    try:
        import pdfplumber
    except ImportError:
        log.warning("pdfplumber not installed. Skipping PDF parsing. Run: pip install pdfplumber")
        return []

    transactions = []
    log.info(f"Parsing bank statement PDF: {pdf_path.name}")

    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages):
                tables = page.extract_tables()
                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    header = [str(c or "").strip().lower() for c in table[0]]

                    # Identify column indices
                    date_col = next((i for i, h in enumerate(header) if "date" in h), None)
                    desc_col = next((i for i, h in enumerate(header) if any(k in h for k in ("narr", "desc", "particular", "detail"))), None)
                    debit_col = next((i for i, h in enumerate(header) if any(k in h for k in ("debit", "withdrawal", "dr"))), None)
                    credit_col = next((i for i, h in enumerate(header) if any(k in h for k in ("credit", "deposit", "cr"))), None)

                    if date_col is None or desc_col is None:
                        continue

                    for row in table[1:]:
                        try:
                            date_raw = str(row[date_col] or "").strip()
                            desc_raw = str(row[desc_col] or "").strip()
                            debit_raw = str(row[debit_col] or "").strip() if debit_col is not None else ""
                            credit_raw = str(row[credit_col] or "").strip() if credit_col is not None else ""

                            if not date_raw or not desc_raw:
                                continue

                            date_str = extract_date(date_raw)
                            if not date_str:
                                continue

                            # Parse amounts — remove commas
                            debit_amt = float(debit_raw.replace(",", "")) if re.match(r"[\d,]+\.?\d*", debit_raw) else 0.0
                            credit_amt = float(credit_raw.replace(",", "")) if re.match(r"[\d,]+\.?\d*", credit_raw) else 0.0

                            if debit_amt > 0:
                                t = build_transaction(date_str, debit_amt, "debit", account, desc_raw, "bank_statement")
                                transactions.append(t)
                            if credit_amt > 0:
                                t = build_transaction(date_str, credit_amt, "credit", account, desc_raw, "bank_statement")
                                transactions.append(t)

                        except Exception as e:
                            log.debug(f"Row parse error (page {page_num}): {e}")

    except Exception as e:
        log.error(f"Failed to open PDF {pdf_path}: {e}")

    log.info(f"  Parsed {len(transactions)} transactions from {pdf_path.name}")
    return transactions


# ─── PDF credit card statement parser ─────────────────────────────────────────

def _parse_cc_pdf_by_text(pdf, card: str) -> list[dict]:
    """
    Fallback: extract CC transactions from raw PDF text when table extraction yields nothing.
    Handles common Indian CC statement text formats:
      "15 Apr 2026  AMAZON SHOPPING  1,299.00  DR"
      "15/04/26  SWIGGY ORDER  450.00"
    """
    transactions = []
    # Match: date  description  amount  optional CR/DR
    row_pat = re.compile(
        r"(\d{1,2}[\s\-/][A-Za-z]{3}[\s\-/]\d{2,4}|\d{2}[/\-]\d{2}[/\-]\d{2,4})"
        r"[ \t]+(.{3,60}?)[ \t]+"
        r"([\d,]+\.\d{2})"
        r"[ \t]*(CR|DR)?",
        re.IGNORECASE,
    )
    for page in pdf.pages:
        text = page.extract_text() or ""
        for m in row_pat.finditer(text):
            date_raw, desc_raw, amt_raw, type_hint = m.groups()
            date_str = extract_date(date_raw.strip())
            if not date_str:
                continue
            try:
                amount = float(amt_raw.replace(",", ""))
                if amount <= 0:
                    continue
                tx_type = "credit" if (type_hint or "DR").upper() == "CR" else "debit"
                t = build_transaction(date_str, amount, tx_type, card, desc_raw.strip(), "cc_statement_text")
                transactions.append(t)
            except Exception:
                pass
    log.info(f"  Text fallback extracted {len(transactions)} transactions")
    return transactions


def parse_cc_statement_pdf(pdf_path: Path, card: str) -> list[dict]:
    """
    Parse a credit card statement PDF.
    1. Tries table extraction (structured PDFs).
    2. Falls back to raw-text regex if tables yield 0 rows.
    Supports password-protected PDFs via ICICI_CC_PDF_PASSWORD / SBI_CC_PDF_PASSWORD env vars.
    """
    try:
        import pdfplumber
    except ImportError:
        log.warning("pdfplumber not installed — skipping PDF parsing")
        return []

    password = ICICI_CC_PDF_PASSWORD if "icici" in card.lower() else SBI_CC_PDF_PASSWORD
    transactions = []
    log.info(f"Parsing CC statement PDF: {pdf_path.name} (password={'set' if password else 'not set'})")

    try:
        open_kwargs: dict = {}
        if password:
            open_kwargs["password"] = password

        with pdfplumber.open(pdf_path, **open_kwargs) as pdf:
            log.info(f"  Opened OK — {len(pdf.pages)} page(s)")

            for page_num, page in enumerate(pdf.pages):
                tables = page.extract_tables()
                log.debug(f"  Page {page_num + 1}: {len(tables)} table(s)")

                for table in tables:
                    if not table or len(table) < 2:
                        continue
                    header = [str(c or "").strip().lower() for c in table[0]]
                    log.info(f"  Table header cols: {header}")

                    date_col = next((i for i, h in enumerate(header) if "date" in h), None)
                    desc_col = next((i for i, h in enumerate(header) if any(
                        k in h for k in ("desc", "narr", "particular", "merchant", "transaction", "detail")
                    )), None)
                    amt_col  = next((i for i, h in enumerate(header) if any(
                        k in h for k in ("amount", "amt", "charge", "inr")
                    )), None)
                    type_col = next((i for i, h in enumerate(header) if any(
                        k in h for k in ("dr/cr", "cr/dr", "type")
                    )), None)

                    if date_col is None or desc_col is None or amt_col is None:
                        log.info(f"  Skipping table — couldn't map columns. "
                                 f"date={date_col} desc={desc_col} amt={amt_col}")
                        continue

                    for row in table[1:]:
                        try:
                            date_raw  = str(row[date_col] or "").strip()
                            desc_raw  = str(row[desc_col] or "").strip()
                            amt_raw   = str(row[amt_col]  or "").strip().replace(",", "")
                            type_hint = str(row[type_col] or "").strip().upper() if type_col is not None else "DR"

                            if not date_raw or not desc_raw or not amt_raw:
                                continue
                            if not re.match(r"[\d.]+", amt_raw):
                                continue

                            date_str = extract_date(date_raw)
                            if not date_str:
                                continue

                            amount   = float(amt_raw)
                            tx_type  = "credit" if "CR" in type_hint else "debit"
                            t = build_transaction(date_str, amount, tx_type, card, desc_raw, "cc_statement")
                            transactions.append(t)

                        except Exception as e:
                            log.debug(f"  CC row parse error (page {page_num + 1}): {e}")

            # ── Fallback to text extraction if tables gave nothing ─────────────
            if not transactions:
                log.warning(f"  Table extraction yielded 0 transactions — trying text fallback")
                transactions = _parse_cc_pdf_by_text(pdf, card)

    except Exception as e:
        err = str(e)
        log.error(f"  Failed to open/parse CC PDF {pdf_path.name}: {err}")
        if "password" in err.lower() or "encrypt" in err.lower() or "incorrect" in err.lower():
            log.error(f"  PDF appears password-protected. Set ICICI_CC_PDF_PASSWORD / "
                      f"SBI_CC_PDF_PASSWORD secret in GitHub Actions.")
        save_pdf_error(pdf_path, err)

    log.info(f"  Parsed {len(transactions)} transactions from {pdf_path.name}")
    return transactions


# ─── Deduplication ────────────────────────────────────────────────────────────

def deduplicate(existing: list[dict], new: list[dict]) -> tuple[list[dict], int]:
    """
    Merge new transactions into existing list, deduplicating by ID.
    Also catches near-duplicates: same account + amount + date + similar description
    (catches cases where same txn arrives as both an alert and a statement row).

    Returns (merged_list, count_added).
    """
    existing_ids = {t["id"] for t in existing}

    # Build a fuzzy-dupe fingerprint set: (account, date, amount_rounded)
    existing_fingerprints = {
        (t["account"], t["date"], round(t["amount"]))
        for t in existing
    }

    added = 0
    merged = list(existing)

    for t in new:
        if t["id"] in existing_ids:
            log.debug(f"Exact dupe skipped: {t['id']}")
            continue

        fp = (t["account"], t["date"], round(t["amount"]))
        if fp in existing_fingerprints:
            log.debug(f"Near-dupe skipped: {t['account']} {t['date']} {t['amount']}")
            continue

        merged.append(t)
        existing_ids.add(t["id"])
        existing_fingerprints.add(fp)
        added += 1

    return merged, added


# ─── Error logging ────────────────────────────────────────────────────────────

def log_parse_error(email: dict, error: str) -> None:
    """Append a failed-parse record to parse_errors.json."""
    errors = []
    if PARSE_ERRORS_PATH.exists():
        try:
            errors = json.loads(PARSE_ERRORS_PATH.read_text())
        except Exception:
            pass

    errors.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "email_id": email.get("id", "unknown"),
        "subject": email.get("subject", ""),
        "from": email.get("from", ""),
        "error": error,
    })

    PARSE_ERRORS_PATH.write_text(json.dumps(errors, indent=2))


def save_pdf_error(pdf_path: Path, error: str) -> None:
    """Append a PDF parse failure to parse_errors.json for post-run diagnosis."""
    errors = []
    if PARSE_ERRORS_PATH.exists():
        try:
            errors = json.loads(PARSE_ERRORS_PATH.read_text())
        except Exception:
            pass
    errors.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "source": "pdf",
        "filename": pdf_path.name,
        "error": error,
    })
    PARSE_ERRORS_PATH.write_text(json.dumps(errors, indent=2))


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    """
    Load pending emails + PDFs, parse all, dedupe, write transactions.json.
    Returns count of new transactions added.
    """
    # Load existing transactions
    existing: list[dict] = []
    if TRANSACTIONS_PATH.exists():
        try:
            existing = json.loads(TRANSACTIONS_PATH.read_text())
            log.info(f"Loaded {len(existing)} existing transactions.")
        except Exception as e:
            log.warning(f"Could not load existing transactions: {e}")

    new_transactions: list[dict] = []

    # ── Parse emails ──────────────────────────────────────────────────────────
    if PENDING_EMAILS_PATH.exists():
        try:
            emails = json.loads(PENDING_EMAILS_PATH.read_text())
            log.info(f"Processing {len(emails)} pending emails...")
        except Exception as e:
            log.error(f"Could not read pending_emails.json: {e}")
            emails = []

        for email in emails:
            try:
                subject = email.get("subject", "").lower()
                sender = email.get("from", "").lower()

                if SMS_FORWARD_SUBJECTS.search(subject):
                    txns = parse_sms_forward(email)
                else:
                    txns = parse_alert_email(email)

                if not txns:
                    log.info(
                        f"No transaction matched — from: {email.get('from','')[:50]}  "
                        f"subject: {email.get('subject','')[:80]}  "
                        f"snippet: {email.get('snippet','')[:120]}"
                    )

                new_transactions.extend(txns)

            except Exception as e:
                log.error(f"Unhandled error parsing email {email.get('id')}: {e}")
                log_parse_error(email, str(e))
    else:
        log.info("No pending_emails.json found. Skipping email parsing.")

    # ── Parse PDFs ────────────────────────────────────────────────────────────
    if TMP_PDF_DIR.exists():
        pdf_files = list(TMP_PDF_DIR.glob("*.pdf"))
        log.info(f"PDF directory found: {TMP_PDF_DIR} — {len(pdf_files)} file(s)")
        for pdf_path in pdf_files:
            log.info(f"Processing PDF: {pdf_path.name}")
            name_lower = pdf_path.name.lower()
            try:
                if "sbi" in name_lower:
                    txns = parse_cc_statement_pdf(pdf_path, "SBI_CC")
                elif "icici" in name_lower and "cc" in name_lower:
                    txns = parse_cc_statement_pdf(pdf_path, "ICICI_CC")
                elif "icici" in name_lower:
                    txns = parse_bank_statement_pdf(pdf_path, "ICICI")
                elif "hdfc" in name_lower:
                    txns = parse_bank_statement_pdf(pdf_path, "HDFC")
                else:
                    log.warning(f"Cannot determine account for PDF: {pdf_path.name}. Skipping.")
                    save_pdf_error(pdf_path, "Cannot determine account from filename")
                    continue

                new_transactions.extend(txns)
            except Exception as e:
                log.error(f"Failed to parse PDF {pdf_path.name}: {e}")
                save_pdf_error(pdf_path, str(e))
    else:
        log.info(f"No PDF directory found at {TMP_PDF_DIR}. Skipping PDF parsing.")

    # ── Deduplicate and merge ─────────────────────────────────────────────────
    merged, added = deduplicate(existing, new_transactions)
    log.info(f"New transactions parsed: {len(new_transactions)}, added after dedup: {added}")

    # Sort by date descending
    merged.sort(key=lambda t: t["date"], reverse=True)

    # ── Write output ─────────────────────────────────────────────────────────
    TRANSACTIONS_PATH.write_text(json.dumps(merged, indent=2, ensure_ascii=False))
    log.info(f"Wrote {len(merged)} transactions to {TRANSACTIONS_PATH.name}")

    return added


if __name__ == "__main__":
    count = main()
    log.info(f"parse_transactions.py done. New transactions added: {count}")
    sys.exit(0)
