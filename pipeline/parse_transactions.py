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


# ─── HTML stripping utility ───────────────────────────────────────────────────

def _strip_html(html: str) -> str:
    """Strip HTML tags and decode common entities, returning plain text."""
    # Remove <script> and <style> blocks entirely
    html = re.sub(r'<(?:script|style)[^>]*>.*?</(?:script|style)>', ' ',
                  html, flags=re.DOTALL | re.IGNORECASE)
    # Replace block-level tags with newlines so sentences don't run together
    html = re.sub(r'<(?:br|p|div|tr|td|li)[^>]*>', ' ', html, flags=re.IGNORECASE)
    # Remove all remaining tags
    html = re.sub(r'<[^>]+>', '', html)
    # Decode common HTML entities
    for ent, ch in (('&nbsp;', ' '), ('&amp;', '&'), ('&lt;', '<'),
                    ('&gt;', '>'), ('&#39;', "'"), ('&quot;', '"')):
        html = html.replace(ent, ch)
    return ' '.join(html.split())


# ─── Alert email parsers ──────────────────────────────────────────────────────
#
# Each bank sends a distinct alert format.  Patterns are derived from real
# emails read directly from the inbox — NOT guessed.
#
# HDFC (alerts@hdfcbank.bank.in)
# ─────────────────────────────
# Format A – UPI / VPA transfer:
#   "Rs.900.00 is debited from your account ending 6961 towards VPA
#    findsuvi@okaxis (SUVRADIP TAPAS CHOUDHURI) on 24-05-26."
#
# Format B – Account-to-account (IMPS/internal):
#   "Rs.42500.00 has been debited from account 6961 to account *9517
#    on 16-05-26."
#
# Format C – ATM withdrawal:
#   "Thank you for using your HDFC Bank Debit Card ending 2472 for ATM
#    withdrawal for Rs 10000.00 in MUMBAI at SUPREME CHAMBERS on 12-05-2026"
#
# ICICI CC (credit_cards@icici.bank.in, credit_cards@icicibank.com)
# ─────────────────────────────────────────────────────────────────
# Format D – CC spend:
#   "Your ICICI Bank Credit Card XX8014 has been used for a transaction of
#    INR 100.00 on May 24, 2026 at 09:50:29. Info: URBANCLAP TECHNOLOGIES IN."
#
# Format E – CC payment received (credit):
#   "We have received payment of INR 32263.11 on your ICICI Bank Credit Card
#    account 4315 XXXX XXXX 8014 on 29-Mar-2026."
#
# ICICI Savings (alert@icici.bank.in, customernotification@icici.bank.in)
# ────────────────────────────────────────────────────────────────────────
# Format F – ATM/debit card withdrawal:
#   "Cash Withdrawal of Rs. 5,000.00 has been made at an ATM using your
#    Debit Card linked to Account XX056 on 29-Apr-26. Info: ATM*S1CNR603*CA."
#
# Format G – NEFT / IMPS outward:
#   "You have made an online NEFT payment of Rs. 16,844.00 towards
#    SHANTI DHAM CHS LTD on May 16, 2026 at 02:12 p.m."
#
# SBI CC (onlinesbicard@sbicard.com)
# ───────────────────────────────────
# Format H – CC spend:
#   "Rs.634.98 spent on your SBI Credit Card ending 5946 at ZOMATO on 23/05/26."

# ── HDFC patterns ──────────────────────────────────────────────────────────

# Format A: "Rs.X is debited from your account ending NNNN towards VPA vpa@upi (Name) on DD-MM-YY."
_HDFC_UPI_VPA = re.compile(
    r"Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+is\s+debited\s+from\s+your\s+account\s+ending\s+\d+"
    r"\s+towards\s+VPA\s+\S+\s+\(([^)]+)\)\s+on\s+(\d{2}-\d{2}-\d{2,4})",
    re.IGNORECASE,
)

# Format B: "Rs.X has been debited from account NNNN to account *NNNN on DD-MM-YY."
_HDFC_TRANSFER = re.compile(
    r"Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+has\s+been\s+debited\s+from\s+account\s+\d+"
    r"\s+to\s+account\s+\*(\d+)\s+on\s+(\d{2}-\d{2}-\d{2,4})",
    re.IGNORECASE,
)

# Format C: "ATM withdrawal for Rs X in CITY at MERCHANT on DD-MM-YYYY HH:MM:SS"
_HDFC_ATM = re.compile(
    r"ATM\s+withdrawal\s+for\s+Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+in\s+\S+"
    r"\s+at\s+([\w\s]+?)\s+on\s+(\d{2}-\d{2}-\d{4})",
    re.IGNORECASE,
)

# ── ICICI CC patterns ───────────────────────────────────────────────────────

# Format D: "transaction of INR/USD X on Mon DD, YYYY at HH:MM:SS. Info: MERCHANT."
_ICICI_CC_SPEND = re.compile(
    r"transaction\s+of\s+(INR|USD)\s*([\d,]+(?:\.\d{1,2})?)"
    r"\s+on\s+(\w+\s+\d{1,2},\s+\d{4})\s+at\s+[\d:]+\."
    r"\s+Info:\s+([^.\n]+)",
    re.IGNORECASE,
)

# Format E: "received payment of INR X on your ICICI Bank Credit Card ... on DD-Mon-YYYY."
_ICICI_CC_PAYMENT = re.compile(
    r"received\s+payment\s+of\s+INR\s*([\d,]+(?:\.\d{1,2})?)"
    r".*?on\s+(\d{1,2}-\w{3}-\d{4})",
    re.IGNORECASE | re.DOTALL,
)

# ── ICICI Savings patterns ──────────────────────────────────────────────────

# Format F: "Cash Withdrawal of Rs. X has been made at an ATM ... on DD-Mon-YY. Info: DETAIL."
_ICICI_ATM = re.compile(
    r"Cash\s+Withdrawal\s+of\s+Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+has\s+been\s+made\s+at\s+an\s+ATM"
    r".*?on\s+(\d{1,2}-\w{3}-\d{2,4})\."
    r"\s*Info:\s+([^\n.]+)",
    re.IGNORECASE | re.DOTALL,
)

# Format G: "NEFT payment of Rs. X towards MERCHANT on Mon DD, YYYY"
_ICICI_NEFT = re.compile(
    r"(?:NEFT|IMPS|UPI)\s+payment\s+of\s+Rs\.?\s*([\d,]+(?:\.\d{1,2})?)"
    r"\s+towards\s+(.+?)\s+on\s+(\w+\s+\d{1,2},\s+\d{4})",
    re.IGNORECASE,
)

# ── SBI CC pattern ──────────────────────────────────────────────────────────

# Format H: "Rs.X spent on your SBI Credit Card ending NNNN at MERCHANT on DD/MM/YY."
_SBI_CC_SPEND = re.compile(
    r"Rs\.?\s*([\d,]+(?:\.\d{1,2})?)\s+spent\s+on\s+your\s+SBI\s+Credit\s+Card"
    r"\s+ending\s+\d+\s+at\s+(.+?)\s+on\s+(\d{2}/\d{2}/\d{2,4})",
    re.IGNORECASE,
)


def _build_full_text(email: dict) -> str:
    """
    Build the best possible plain-text representation of an email.
    Priority: text/plain body → stripped text/html body → snippet.
    The snippet is always prepended so short, snippet-only emails still work.
    """
    plain_parts: list[str] = []
    html_parts: list[str] = []

    for part in email.get("parts", []):
        mime = part.get("mime", "")
        text = part.get("text", "")
        if not text:
            continue
        if mime == "text/plain":
            plain_parts.append(text)
        elif mime == "text/html":
            html_parts.append(_strip_html(text))

    body = " ".join(plain_parts) if plain_parts else " ".join(html_parts)
    snippet = email.get("snippet", "")
    combined = f"{snippet} {body}".strip()
    return " ".join(combined.split())  # normalise whitespace


def _safe_amount(raw: str) -> Optional[float]:
    try:
        return float(raw.replace(",", ""))
    except (ValueError, AttributeError):
        return None


def _parse_hdfc(email: dict, full_text: str) -> list[dict]:
    """Parse all HDFC alert formats (UPI VPA, account transfer, ATM)."""
    results: list[dict] = []
    date_fallback = datetime.now().strftime("%Y-%m-%d")

    # Format A – UPI / VPA
    m = _HDFC_UPI_VPA.search(full_text)
    if m:
        amt = _safe_amount(m.group(1))
        merchant = m.group(2).strip()
        date_str = extract_date(m.group(3)) or date_fallback
        if amt and amt > 0:
            results.append(build_transaction(date_str, amt, "debit", "HDFC",
                                             merchant, "email_alert"))
            return results

    # Format B – account-to-account transfer
    m = _HDFC_TRANSFER.search(full_text)
    if m:
        amt = _safe_amount(m.group(1))
        desc = f"Transfer to *{m.group(2)}"
        date_str = extract_date(m.group(3)) or date_fallback
        if amt and amt > 0:
            results.append(build_transaction(date_str, amt, "debit", "HDFC",
                                             desc, "email_alert"))
            return results

    # Format C – ATM withdrawal
    m = _HDFC_ATM.search(full_text)
    if m:
        amt = _safe_amount(m.group(1))
        merchant = m.group(2).strip()
        date_str = extract_date(m.group(3)) or date_fallback
        if amt and amt > 0:
            results.append(build_transaction(date_str, amt, "debit", "HDFC",
                                             f"ATM {merchant}", "email_alert"))
            return results

    return results


def _parse_icici_cc(email: dict, full_text: str) -> list[dict]:
    """Parse ICICI Credit Card alert formats (spend + payment received)."""
    results: list[dict] = []
    date_fallback = datetime.now().strftime("%Y-%m-%d")

    # Format D – CC spend (debit)
    m = _ICICI_CC_SPEND.search(full_text)
    if m:
        currency = m.group(1).upper()  # INR or USD
        amt = _safe_amount(m.group(2))
        date_str = extract_date(m.group(3)) or date_fallback
        merchant = m.group(4).strip()
        if amt and amt > 0:
            t = build_transaction(date_str, amt, "debit", "ICICI_CC",
                                  merchant, "email_alert")
            if currency != "INR":
                t["currency"] = currency
            results.append(t)
            return results

    # Format E – CC payment received (credit)
    m = _ICICI_CC_PAYMENT.search(full_text)
    if m:
        amt = _safe_amount(m.group(1))
        date_str = extract_date(m.group(2)) or date_fallback
        if amt and amt > 0:
            results.append(build_transaction(date_str, amt, "credit", "ICICI_CC",
                                             "CC Payment Received", "email_alert"))
            return results

    return results


def _parse_icici_savings(email: dict, full_text: str) -> list[dict]:
    """Parse ICICI Savings account alert formats (ATM + NEFT)."""
    results: list[dict] = []
    date_fallback = datetime.now().strftime("%Y-%m-%d")

    # Format F – ATM / debit card withdrawal
    m = _ICICI_ATM.search(full_text)
    if m:
        amt = _safe_amount(m.group(1))
        date_str = extract_date(m.group(2)) or date_fallback
        info = m.group(3).strip()
        if amt and amt > 0:
            results.append(build_transaction(date_str, amt, "debit", "ICICI",
                                             f"ATM {info}", "email_alert"))
            return results

    # Format G – NEFT / IMPS outward payment
    m = _ICICI_NEFT.search(full_text)
    if m:
        amt = _safe_amount(m.group(1))
        merchant = m.group(2).strip()
        date_str = extract_date(m.group(3)) or date_fallback
        if amt and amt > 0:
            results.append(build_transaction(date_str, amt, "debit", "ICICI",
                                             merchant, "email_alert"))
            return results

    return results


def _parse_sbi_cc(email: dict, full_text: str) -> list[dict]:
    """Parse SBI Credit Card alert format."""
    results: list[dict] = []
    date_fallback = datetime.now().strftime("%Y-%m-%d")

    # Format H – CC spend
    m = _SBI_CC_SPEND.search(full_text)
    if m:
        amt = _safe_amount(m.group(1))
        merchant = m.group(2).strip()
        date_str = extract_date(m.group(3)) or date_fallback
        if amt and amt > 0:
            results.append(build_transaction(date_str, amt, "debit", "SBI_CC",
                                             merchant, "email_alert"))
            return results

    return results


def parse_alert_email(email: dict) -> list[dict]:
    """
    Parse a bank transaction alert email into Transaction dicts.
    Supports HDFC savings, ICICI CC, ICICI savings, and SBI CC formats.
    Routes to the correct per-bank parser based on sender address.
    Returns list of parsed transactions (usually 1, occasionally 0).
    """
    sender = email.get("from", "").lower()
    full_text = _build_full_text(email)

    # ── Sender routing ────────────────────────────────────────────────────────
    # Matches both legacy domains (icicibank.com, hdfcbank.net) and the
    # RBI-mandated .bank.in domains (hdfcbank.bank.in, icici.bank.in).

    if "hdfc" in sender:
        return _parse_hdfc(email, full_text)

    if "icici" in sender:
        # credit_cards@icici.bank.in  /  credit_cards@icicibank.com
        if "credit_cards" in sender:
            return _parse_icici_cc(email, full_text)
        # alert@icici.bank.in  (ATM / debit card alerts for savings account)
        # customernotification@icici.bank.in  (NEFT / IMPS)
        if "alert@" in sender or "customernotification" in sender:
            return _parse_icici_savings(email, full_text)
        # cards@icici.bank.in sends upcoming-payment reminders AND confirmations.
        # Confirmations duplicate credit_cards@icici.bank.in — skip to avoid dupes.
        # Other ICICI senders (marketing, KYC, services) carry no transactions.
        return []

    if "sbicard" in sender:
        return _parse_sbi_cc(email, full_text)

    return []  # Unknown sender


# ─── SMS forward parser ───────────────────────────────────────────────────────
# Forwarded SMS emails contain raw SMS text in the body.
# We detect them by subject keywords and reuse alert parsing; only the
# raw_source tag differs.

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
