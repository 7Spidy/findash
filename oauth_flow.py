"""
Run this once to generate token.json via Gmail OAuth2.
Requirements: pip install google-auth-oauthlib google-auth-httplib2
"""
import subprocess, sys, os

# Auto-install deps if missing
for pkg in ["google-auth-oauthlib", "google-auth-httplib2"]:
    try:
        __import__(pkg.replace("-", "_").split(".")[0])
    except ImportError:
        subprocess.check_call([sys.executable, "-m", "pip", "install", pkg])

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.modify",
]

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
CREDS_FILE = os.path.join(SCRIPT_DIR, "credentials.json")
TOKEN_FILE = os.path.join(SCRIPT_DIR, "token.json")

if not os.path.exists(CREDS_FILE):
    print(f"ERROR: credentials.json not found at {CREDS_FILE}")
    sys.exit(1)

flow = InstalledAppFlow.from_client_secrets_file(CREDS_FILE, SCOPES)
creds = flow.run_local_server(port=0, open_browser=True)

with open(TOKEN_FILE, "w") as f:
    f.write(creds.to_json())

print(f"\n✅ token.json saved to: {TOKEN_FILE}")
