"""
fetch_emails.py
───────────────
Fetches new financial alert emails and statement PDFs from Gmail using OAuth2.

Saves raw email metadata to /data/raw/emails_{timestamp}.json
Downloads PDF attachments to /tmp/pdfs/

Environment / credentials:
  - Reads credentials from GMAIL_CREDENTIALS_JSON and GMAIL_TOKEN_JSON env vars
    (base64-encoded), OR falls back to local credentials.json + token.json files.
  - Stores last-run timestamp in data/last_updated.json to avoid re-fetching.

Run standalone:
    python pipeline/fetch_emails.py
"""

import base64
import json
import logging
import os
import re
import sys
from datetime import datetime, timezone
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
RAW_DIR = DATA_DIR / "raw"
TMP_PDF_DIR = Path(os.environ.get("TEMP", "/tmp")) / "findash_pdfs"

DATA_DIR.mkdir(exist_ok=True)
RAW_DIR.mkdir(exist_ok=True)
TMP_PDF_DIR.mkdir(exist_ok=True)

LAST_UPDATED_PATH = DATA_DIR / "last_updated.json"
CREDENTIALS_PATH = REPO_ROOT / "credentials.json"
TOKEN_PATH = REPO_ROOT / "token.json"

GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]

# ─── Sender filters ───────────────────────────────────────────────────────────
# Use domain-based matching so ALL addresses at each bank domain are captured,
# not just the handful of specific addresses we happen to know about.
# Indian banks send from many different local-parts (alerts@, noreply@,
# hdfcbanksmsmobile@, notify@, etc.) — exact-address lists always miss some.
BANK_DOMAINS = [
    "hdfcbank.net",   # HDFC alerts, statements
    "hdfcbank.com",   # HDFC alternate domain
    "icicibank.com",  # ICICI savings + CC alerts + statements
    "sbicard.com",    # SBI Credit Card
]

FULL_QUERY = "(" + " OR ".join(f"from:{d}" for d in BANK_DOMAINS) + ")"


# ─── OAuth2 credential helpers ────────────────────────────────────────────────

def _load_credentials_from_env() -> tuple[dict | None, dict | None]:
    """
    Load credentials from environment variables (used in GitHub Actions).
    Returns (credentials_dict, token_dict) or (None, None) if env vars absent.
    """
    cred_b64 = os.environ.get("GMAIL_CREDENTIALS_JSON")
    tok_b64 = os.environ.get("GMAIL_TOKEN_JSON")

    if cred_b64 and tok_b64:
        try:
            creds_data = json.loads(base64.b64decode(cred_b64))
            token_data = json.loads(base64.b64decode(tok_b64))
            log.info("Loaded Gmail credentials from environment variables.")
            return creds_data, token_data
        except Exception as e:
            log.error(f"Failed to decode credentials from env vars: {e}")

    return None, None


def _load_credentials_from_files() -> tuple[dict | None, dict | None]:
    """Load credentials from local JSON files (dev mode)."""
    creds_data = token_data = None

    if CREDENTIALS_PATH.exists():
        creds_data = json.loads(CREDENTIALS_PATH.read_text())
        log.info(f"Loaded credentials from {CREDENTIALS_PATH}")
    else:
        log.warning(f"credentials.json not found at {CREDENTIALS_PATH}")

    if TOKEN_PATH.exists():
        token_data = json.loads(TOKEN_PATH.read_text())
        log.info(f"Loaded token from {TOKEN_PATH}")
    else:
        log.warning(f"token.json not found at {TOKEN_PATH}")

    return creds_data, token_data


def build_gmail_service():
    """
    Build and return an authenticated Gmail API service object.
    Tries env vars first, then local files.
    Raises RuntimeError if credentials cannot be loaded.
    """
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
    except ImportError:
        raise ImportError(
            "Google API libraries not installed. "
            "Run: pip install google-api-python-client google-auth-httplib2 google-auth-oauthlib"
        )

    creds_data, token_data = _load_credentials_from_env()
    if not creds_data or not token_data:
        creds_data, token_data = _load_credentials_from_files()

    if not creds_data or not token_data:
        raise RuntimeError(
            "No Gmail credentials found. Set GMAIL_CREDENTIALS_JSON and "
            "GMAIL_TOKEN_JSON env vars, or place credentials.json and token.json "
            "in the repo root."
        )

    # Build the Credentials object from token data
    installed = creds_data.get("installed", creds_data)
    creds = Credentials(
        token=token_data.get("token"),
        refresh_token=token_data.get("refresh_token"),
        token_uri=token_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=token_data.get("client_id") or installed.get("client_id"),
        client_secret=token_data.get("client_secret") or installed.get("client_secret"),
        scopes=GMAIL_SCOPES,
    )

    # Refresh if expired
    if creds.expired and creds.refresh_token:
        log.info("Access token expired, refreshing...")
        creds.refresh(Request())
        # Persist updated token back to file (only in dev mode)
        if TOKEN_PATH.exists():
            token_data["token"] = creds.token
            token_data["expiry"] = creds.expiry.isoformat() if creds.expiry else None
            TOKEN_PATH.write_text(json.dumps(token_data, indent=2))
            log.info("Token refreshed and saved.")

    service = build("gmail", "v1", credentials=creds)
    log.info("Gmail API service ready.")
    return service


# ─── Timestamp helpers ────────────────────────────────────────────────────────

def _get_last_run_timestamp() -> str:
    """
    Return the Gmail after: query timestamp for incremental fetching.
    Reads from last_updated.json; defaults to 7 days ago on first run.
    """
    if LAST_UPDATED_PATH.exists():
        try:
            data = json.loads(LAST_UPDATED_PATH.read_text())
            ts = data.get("timestamp", "")
            if ts:
                # Gmail after: needs epoch seconds
                dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
                epoch = int(dt.timestamp())
                log.info(f"Fetching emails since: {ts}")
                return str(epoch)
        except Exception as e:
            log.warning(f"Could not parse last_updated.json timestamp: {e}")

    # Default: last 7 days
    from datetime import timedelta
    default_dt = datetime.now(timezone.utc) - timedelta(days=7)
    log.info("No last-run timestamp found. Fetching last 7 days.")
    return str(int(default_dt.timestamp()))


# ─── Email fetching ───────────────────────────────────────────────────────────

def _decode_body(data: str) -> str:
    """Base64url-decode email body part."""
    padding = 4 - len(data) % 4
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data).decode("utf-8", errors="replace")


def _extract_parts(payload: dict, parts_out: list[dict]) -> None:
    """Recursively collect all body parts (text/plain, text/html, attachments)."""
    mime = payload.get("mimeType", "")
    body = payload.get("body", {})

    if mime in ("text/plain", "text/html"):
        data = body.get("data", "")
        if data:
            parts_out.append({
                "mime": mime,
                "text": _decode_body(data),
            })

    elif body.get("attachmentId"):
        filename = payload.get("filename", "attachment")
        if filename.lower().endswith(".pdf"):
            parts_out.append({
                "mime": mime,
                "filename": filename,
                "attachment_id": body["attachmentId"],
            })

    for sub in payload.get("parts", []):
        _extract_parts(sub, parts_out)


def fetch_emails(service, since_epoch: str) -> list[dict]:
    """
    Fetch emails matching FULL_QUERY since since_epoch.
    Returns list of dicts with metadata + body text + attachment references.
    """
    query = f"{FULL_QUERY} after:{since_epoch}"
    log.info(f"Gmail query: {query}")

    results = []
    page_token = None

    while True:
        resp = service.users().messages().list(
            userId="me",
            q=query,
            maxResults=100,
            pageToken=page_token,
        ).execute()

        messages = resp.get("messages", [])
        log.info(f"  Found {len(messages)} messages (page)")

        for msg_ref in messages:
            try:
                msg = service.users().messages().get(
                    userId="me",
                    id=msg_ref["id"],
                    format="full",
                ).execute()

                # Parse headers
                headers = {h["name"]: h["value"] for h in msg.get("payload", {}).get("headers", [])}
                parts: list[dict] = []
                _extract_parts(msg.get("payload", {}), parts)

                email_record = {
                    "id": msg["id"],
                    "thread_id": msg["threadId"],
                    "date": headers.get("Date", ""),
                    "from": headers.get("From", ""),
                    "subject": headers.get("Subject", ""),
                    "snippet": msg.get("snippet", ""),
                    "internal_date": int(msg.get("internalDate", 0)) // 1000,
                    "parts": parts,
                }
                results.append(email_record)

            except Exception as e:
                log.error(f"Failed to fetch message {msg_ref['id']}: {e}")

        page_token = resp.get("nextPageToken")
        if not page_token:
            break

    log.info(f"Total emails fetched: {len(results)}")
    return results


def _bank_tag(sender: str) -> str:
    """Derive a short bank identifier from a sender email address."""
    s = sender.lower()
    if "sbicard" in s:
        return "sbi_cc"
    if "icicicredit" in s or "ccalerts" in s:
        return "icici_cc"
    if "icicibank" in s:
        return "icici"
    if "hdfcbank" in s:
        return "hdfc"
    return "unknown"


def download_pdf_attachments(service, emails: list[dict]) -> dict[str, Path]:
    """
    Download PDF attachments from fetched emails to TMP_PDF_DIR.
    Returns mapping of attachment_id -> local file path.
    """
    paths: dict[str, Path] = {}

    for email in emails:
        tag = _bank_tag(email.get("from", ""))
        for part in email.get("parts", []):
            att_id = part.get("attachment_id")
            if not att_id:
                continue
            filename = part.get("filename", f"attachment_{att_id}.pdf")
            out_path = TMP_PDF_DIR / f"{tag}_{email['id']}_{filename}"

            if out_path.exists():
                log.debug(f"PDF already downloaded: {out_path.name}")
                paths[att_id] = out_path
                continue

            try:
                att = service.users().messages().attachments().get(
                    userId="me",
                    messageId=email["id"],
                    id=att_id,
                ).execute()
                data = base64.urlsafe_b64decode(att["data"])
                out_path.write_bytes(data)
                paths[att_id] = out_path
                log.info(f"Downloaded PDF: {out_path.name} ({len(data):,} bytes)")
            except Exception as e:
                log.error(f"Failed to download attachment {att_id}: {e}")

    return paths


def save_raw_emails(emails: list[dict]) -> Path:
    """Save raw email records to /data/raw/ for debugging and auditing."""
    if not emails:
        return None

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    out_path = RAW_DIR / f"emails_{ts}.json"
    # Strip decoded text to keep raw files smaller; parse_transactions.py uses the live Gmail data
    slim = [{k: v for k, v in e.items() if k != "parts"} for e in emails]
    out_path.write_text(json.dumps(slim, indent=2, ensure_ascii=False))
    log.info(f"Saved raw email index: {out_path.name}")
    return out_path


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    """
    Entry point for the fetch step.
    Returns number of emails fetched (used by pipeline orchestrator).
    """
    try:
        service = build_gmail_service()
    except (ImportError, RuntimeError) as e:
        log.error(f"Cannot connect to Gmail: {e}")
        return 0

    since = _get_last_run_timestamp()
    emails = fetch_emails(service, since)

    if not emails:
        log.info("No new emails found.")
        return 0

    save_raw_emails(emails)

    pdf_paths = download_pdf_attachments(service, emails)
    log.info(f"PDFs downloaded: {len(pdf_paths)}")

    # Persist email data for parse_transactions.py to pick up
    pending_path = DATA_DIR / "raw" / "pending_emails.json"
    pending_path.write_text(json.dumps(emails, indent=2, ensure_ascii=False))
    log.info(f"Wrote {len(emails)} emails to pending_emails.json for parsing.")

    return len(emails)


if __name__ == "__main__":
    count = main()
    log.info(f"fetch_emails.py done. Emails fetched: {count}")
    sys.exit(0)
