# Spend Dash — Personal Financial Dashboard

A self-hosted financial dashboard that auto-updates daily from your Gmail (HDFC, ICICI bank alerts and PDF statements, SBI and ICICI credit cards).

## Architecture

```
Gmail → GitHub Actions (6AM IST daily) → Python pipeline → /data/*.json → Vercel (Next.js 15)
```

## Quick Start (Development)

```bash
# 1. Install frontend dependencies
npm install

# 2. Generate mock data (no Gmail needed)
python pipeline/generate_mock_data.py

# 3. Copy mock data to public folder
cp data/*.json public/data/

# 4. Start dev server
npm run dev
# Open http://localhost:3000
```

## Project Structure

```
pipeline/           Python data pipeline
  fetch_emails.py     Gmail API fetcher
  parse_transactions.py  Email + PDF parser
  generate_insights.py   Claude AI insights
  categoriser.py      Keyword-based categoriser
  generate_mock_data.py  Mock data for dev
  requirements.txt

public/data/        Static JSON served by Next.js
  transactions.json
  accounts.json
  credit_cards.json
  insights.json
  last_updated.json

app/                Next.js App Router pages
components/         Reusable UI components
lib/                Helpers (data loading, formatting)
types/              TypeScript type definitions
middleware.ts       Password protection
```

## Setting Up Gmail OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **Gmail API**
3. OAuth consent screen → External → Add your Gmail as test user
4. Credentials → OAuth 2.0 Client ID → Desktop app → Download JSON as `credentials.json`
5. Run the OAuth flow once locally:
   ```bash
   pip install -r pipeline/requirements.txt
   python pipeline/oauth_flow.py   # opens browser, saves token.json
   ```
6. Base64-encode both files for GitHub Actions:
   ```bash
   # Windows PowerShell
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("credentials.json")) | Out-File credentials_b64.txt
   [Convert]::ToBase64String([IO.File]::ReadAllBytes("token.json")) | Out-File token_b64.txt
   ```

## GitHub Actions Secrets

Go to your repo → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Value |
|--------|-------|
| `GMAIL_CREDENTIALS_JSON` | Contents of `credentials_b64.txt` |
| `GMAIL_TOKEN_JSON` | Contents of `token_b64.txt` |
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `DASHBOARD_PASSWORD` | Password to protect the dashboard |

## Deploying to Vercel

1. Push this repo to GitHub (make sure `public/data/*.json` is committed)
2. Import the project at [vercel.com/new](https://vercel.com/new)
3. Add environment variables in Vercel dashboard:
   - `DASHBOARD_PASSWORD` — your chosen password
4. Deploy — Vercel auto-deploys on every push (GitHub Actions pushes updated data daily)

## Running the Pipeline Manually

```bash
pip install -r pipeline/requirements.txt

# Fetch new emails from Gmail
python pipeline/fetch_emails.py

# Parse emails and PDFs into transactions.json
python pipeline/parse_transactions.py

# Generate AI insights (requires ANTHROPIC_API_KEY)
ANTHROPIC_API_KEY=sk-ant-... python pipeline/generate_insights.py

# Copy to public/ and restart dev server
cp data/*.json public/data/
```

## Adding New Bank/Card Formats

Edit `pipeline/parse_transactions.py`:
- Add regex patterns to `parse_alert_email()` for new alert formats
- Failed parses are logged to `data/parse_errors.json` (never crashes the pipeline)

Edit `pipeline/categoriser.py`:
- Add keywords to `CATEGORY_RULES` to categorise new merchants

## Keeping Data in Sync

The GitHub Actions workflow (`.github/workflows/update-dashboard.yml`) runs at 6:00 AM IST daily:
1. Fetches new emails since last run
2. Parses and deduplicates transactions
3. Generates AI insights via Claude API
4. Commits updated `/data/*.json` back to the repo
5. Vercel auto-deploys the new data

You can also trigger it manually: GitHub → Actions → Update Financial Dashboard → Run workflow.
