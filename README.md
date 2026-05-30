# Spend Dash

Drop your bank or credit card PDFs. Get instant AI-powered spending analysis — no sign-up, no server, no data stored.

---

**Upload → Parse → Insights** in under 30 seconds.

- Drag in one or more Indian bank/CC statements (HDFC, ICICI, SBI, Axis, Kotak…)
- Claude AI extracts every transaction, categorises merchants, and detects subscriptions, anomalies, and trends
- Interactive charts: category donut, monthly breakdown, net cash flow sparkline
- Export a clean PDF report
- Everything lives in your browser session — close the tab and it's gone

## Stack

- **Next.js 15** (App Router) — frontend + API route
- **Claude AI** — Haiku for structured PDF parsing, Sonnet for financial insights
- **Recharts** — charts
- **jsPDF** — PDF export
- **pdfjs-dist** — client-side PDF text extraction

## Running locally

```bash
npm install
# Add your Anthropic API key
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), upload a statement PDF, done.
