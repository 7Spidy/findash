'use client'

import type { ParsedStatement, AIInsight, CCSummary, SavingsSummary } from '@/types'
import { formatINR, formatDate } from './utils'

function safe(text: string): string {
  return (text ?? '')
    .replace(/₹/g, 'Rs.')
    .replace(/[—–]/g, '-')
    .replace(/['']/g, "'")
    .replace(/[""]/g, '"')
    .replace(/•/g, '*')
    .replace(/[^\x20-\x7E]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function amt(n: number): string {
  return safe(formatINR(n))
}

// Palette
const C = {
  white:   [255, 255, 255] as [number, number, number],
  offwhite:[250, 248, 243] as [number, number, number],
  light:   [243, 240, 233] as [number, number, number],
  border:  [230, 224, 212] as [number, number, number],
  text:    [15,  23,  42]  as [number, number, number],
  muted:   [107, 114, 128] as [number, number, number],
  subtle:  [156, 163, 175] as [number, number, number],
  accent:  [123, 63,  0]   as [number, number, number],
  green:   [5,   150, 105] as [number, number, number],
  red:     [220, 38,  38]  as [number, number, number],
  amber:   [217, 119, 6]   as [number, number, number],
  blue:    [37,  99,  235] as [number, number, number],
  orange:  [234, 88,  12]  as [number, number, number],
}

// Category accent colors for visual indicators
const CAT_COLORS: Record<string, [number, number, number]> = {
  'Food & Dining': [249, 115, 22],
  'Transport':     [59,  130, 246],
  'Shopping':      [168, 85,  247],
  'Entertainment': [236, 72,  153],
  'Subscriptions': [99,  102, 241],
  'Utilities':     [234, 179, 8],
  'Travel':        [14,  165, 233],
  'Investments':   [34,  197, 94],
  'Health':        [239, 68,  68],
  'Others':        [107, 114, 128],
}

const INSIGHT_COLORS: Record<string, [number, number, number]> = {
  subscription: [217, 119, 6],
  anomaly:      [220, 38,  38],
  trend:        [59,  130, 246],
  savings_tip:  [37,  99,  235],
  cc_health:    [5,   150, 105],
}

export async function exportPDF(
  statements: ParsedStatement[],
  insights: AIInsight[]
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const W = 210
  const H = 297
  const mg = 18          // page margin
  const cW = W - mg * 2  // content width
  let y = mg

  // ── helpers ──────────────────────────────────────────────────────────────────

  function newPage() {
    doc.addPage()
    doc.setFillColor(...C.white)
    doc.rect(0, 0, W, H, 'F')
    y = mg
    // Subtle top accent stripe
    doc.setFillColor(...C.accent)
    doc.rect(0, 0, W, 1.5, 'F')
  }

  function guard(need = 20) {
    if (y + need > H - mg) newPage()
  }

  // Page number footer helper (called at end)
  const pages: number[] = []

  function sectionHeading(title: string) {
    guard(18)
    // Accent left bar + heading text in Times Bold
    doc.setFillColor(...C.accent)
    doc.rect(mg, y, 3, 9, 'F')
    doc.setFontSize(13)
    doc.setFont('times', 'bold')
    doc.setTextColor(...C.accent)
    doc.text(title.toUpperCase(), mg + 6, y + 6.5)
    y += 9
    // Thin divider line
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.25)
    doc.line(mg, y + 1, mg + cW, y + 1)
    y += 6
    doc.setFont('helvetica', 'normal')
  }

  function kv(k: string, v: string, vColor: [number, number, number] = C.text, xOffset = 58) {
    guard(6)
    doc.setFontSize(8.5)
    doc.setTextColor(...C.muted)
    doc.setFont('helvetica', 'normal')
    doc.text(k, mg, y)
    doc.setTextColor(...vColor)
    doc.setFont('times', 'bold')
    doc.text(v, mg + xOffset, y)
    doc.setFont('helvetica', 'normal')
    y += 5.5
  }

  function statBox(
    x: number, bY: number, bW: number, bH: number,
    label: string, value: string, vColor: [number, number, number]
  ) {
    doc.setFillColor(...C.offwhite)
    doc.roundedRect(x, bY, bW, bH, 2.5, 2.5, 'F')
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.2)
    doc.roundedRect(x, bY, bW, bH, 2.5, 2.5, 'S')

    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.muted)
    doc.text(label, x + bW / 2, bY + 7, { align: 'center' })

    doc.setFontSize(14)
    doc.setFont('times', 'bold')
    doc.setTextColor(...vColor)
    doc.text(value, x + bW / 2, bY + 16, { align: 'center' })
    doc.setFont('helvetica', 'normal')
  }

  // ── COVER PAGE ────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.white)
  doc.rect(0, 0, W, H, 'F')

  // Dark header band
  doc.setFillColor(...C.accent)
  doc.rect(0, 0, W, 70, 'F')

  // Subtle texture lines
  doc.setDrawColor(255, 255, 255)
  doc.setLineWidth(0.08)
  for (let i = 0; i < 12; i++) {
    doc.line(0, i * 7, W, i * 7 - 14)
  }

  // Logo / title
  doc.setFontSize(38)
  doc.setFont('times', 'bold')
  doc.setTextColor(...C.white)
  doc.text('SpendDash', W / 2, 32, { align: 'center' })

  doc.setFontSize(11)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(255, 220, 180)
  doc.text('Personal Financial Report', W / 2, 44, { align: 'center' })

  // Horizontal rule under header
  doc.setFillColor(...C.offwhite)
  doc.rect(0, 70, W, 4, 'F')

  // Period + statements
  const allDates = statements
    .flatMap((s) => [s.period_start, s.period_end])
    .filter(Boolean)
    .sort()

  const periodStr =
    allDates.length >= 2
      ? `${formatDate(allDates[0])} to ${formatDate(allDates[allDates.length - 1])}`
      : allDates[0]
        ? formatDate(allDates[0])
        : 'Unknown Period'

  doc.setFontSize(20)
  doc.setFont('times', 'bold')
  doc.setTextColor(...C.text)
  doc.text(periodStr, W / 2, 92, { align: 'center' })

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.muted)
  doc.text(
    `${statements.length} statement${statements.length !== 1 ? 's' : ''}  ·  Generated on ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    W / 2,
    101,
    { align: 'center' }
  )

  // Stat boxes (3 side by side)
  let totalSpend = 0
  let totalIncome = 0
  for (const stmt of statements) {
    for (const t of stmt.transactions) {
      if (!t.is_cc_bill_payment && t.txn_type === 'debit') totalSpend += t.amount
      if (stmt.account_type === 'savings' && t.txn_type === 'credit') totalIncome += t.amount
    }
  }
  const netFlow = totalIncome - totalSpend

  const bW = 52, bH = 24, bGap = 6
  const bX0 = mg
  const bY0 = 114
  statBox(bX0,             bY0, bW, bH, 'TOTAL SPEND',  amt(totalSpend), C.red)
  statBox(bX0 + bW + bGap, bY0, bW, bH, 'TOTAL INCOME', amt(totalIncome), C.green)
  statBox(bX0 + (bW + bGap) * 2, bY0, bW, bH, 'NET FLOW',
    (netFlow >= 0 ? '+' : '') + amt(Math.abs(netFlow)),
    netFlow >= 0 ? C.green : C.red
  )

  // Account type pills
  const acctTypes = [...new Set(statements.map((s) => s.account_type === 'credit_card' ? 'Credit Card' : 'Savings'))]
  const banks = [...new Set(statements.map((s) => s.bank))].slice(0, 4)
  doc.setFontSize(8)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.muted)
  doc.text(`Accounts: ${banks.join(', ')}  ·  Types: ${acctTypes.join(', ')}`, W / 2, 148, { align: 'center' })

  // Decorative divider
  doc.setDrawColor(...C.border)
  doc.setLineWidth(0.4)
  doc.line(mg + 20, 154, W - mg - 20, 154)

  // Privacy note
  doc.setFontSize(8)
  doc.setTextColor(...C.subtle)
  doc.text(
    'All data was processed entirely in your browser. Nothing was uploaded to any server.',
    W / 2, 162, { align: 'center' }
  )

  // Footer
  doc.setFontSize(7.5)
  doc.setTextColor(...C.subtle)
  doc.text('SpendDash  ·  spend-dash.vercel.app', W / 2, H - 12, { align: 'center' })

  // ── PAGE 2: FINANCIAL SUMMARY ─────────────────────────────────────────────────
  newPage()
  sectionHeading('Financial Summary')

  for (const stmt of statements) {
    guard(50)
    // Statement header band
    doc.setFillColor(...C.light)
    doc.roundedRect(mg, y, cW, 10, 2, 2, 'F')
    doc.setFillColor(...C.accent)
    doc.roundedRect(mg, y, 3, 10, 1, 1, 'F')

    doc.setFontSize(10)
    doc.setFont('times', 'bold')
    doc.setTextColor(...C.text)
    doc.text(safe(stmt.account_label), mg + 6, y + 6.5)

    const typeLabel = stmt.account_type === 'credit_card' ? 'Credit Card' : 'Savings'
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.muted)
    doc.text(
      `${safe(stmt.bank)}  ·  ${typeLabel}  ·  ${formatDate(stmt.period_start)} – ${formatDate(stmt.period_end)}`,
      mg + cW,
      y + 6.5,
      { align: 'right' }
    )
    y += 14

    if (stmt.account_type === 'savings') {
      const s = stmt.summary as SavingsSummary
      kv('Opening Balance', amt(s.opening_balance ?? 0))
      kv('Closing Balance', amt(s.closing_balance ?? 0))
      kv('Total Credits',   amt(s.total_credits ?? 0),   C.green)
      kv('Total Debits',    amt(s.total_debits ?? 0),    C.red)
    } else {
      const s = stmt.summary as CCSummary
      kv('Credit Limit',    amt(s.credit_limit ?? 0))
      kv('Outstanding',     amt(s.total_outstanding ?? 0),  C.red)
      kv('Minimum Due',     `${amt(s.minimum_due ?? 0)}  by  ${formatDate(s.due_date ?? '')}`, C.amber)
      kv('Cashback Earned', amt(s.cashback_earned ?? 0),    C.green)
      if ((s.rewards_points ?? 0) > 0) kv('Reward Points', `${s.rewards_points} pts`)
    }
    y += 6
  }

  // ── SPEND BY CATEGORY ─────────────────────────────────────────────────────────
  newPage()
  sectionHeading('Spend by Category')

  const catMap: Record<string, number> = {}
  let catTotal = 0
  const catTxnCount: Record<string, number> = {}
  for (const stmt of statements) {
    for (const t of stmt.transactions) {
      if (t.is_cc_bill_payment || t.txn_type === 'credit') continue
      catMap[t.category] = (catMap[t.category] ?? 0) + t.amount
      catTxnCount[t.category] = (catTxnCount[t.category] ?? 0) + 1
      catTotal += t.amount
    }
  }
  const sortedCats = Object.entries(catMap).sort(([, a], [, b]) => b - a)

  // Table header
  doc.setFillColor(...C.text)
  doc.rect(mg, y, cW, 8, 'F')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text('CATEGORY',   mg + 10, y + 5.2)
  doc.text('AMOUNT',     mg + 105, y + 5.2)
  doc.text('SHARE',      mg + 140, y + 5.2)
  doc.text('TXNS',       mg + 164, y + 5.2)
  y += 8

  sortedCats.forEach(([cat, catAmt], idx) => {
    guard(8)
    if (idx % 2 === 0) {
      doc.setFillColor(...C.offwhite)
      doc.rect(mg, y, cW, 7.5, 'F')
    }

    // Category color dot
    const cc = CAT_COLORS[cat] ?? C.muted
    doc.setFillColor(...cc)
    doc.circle(mg + 4, y + 3.8, 2, 'F')

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.text)
    doc.text(cat, mg + 9, y + 5)

    const pct = catTotal > 0 ? ((catAmt / catTotal) * 100) : 0

    // Mini bar
    const barX = mg + 90
    const barW = 12
    doc.setFillColor(...C.border)
    doc.rect(barX, y + 2.5, barW, 2.5, 'F')
    doc.setFillColor(...cc)
    doc.rect(barX, y + 2.5, barW * (pct / 100), 2.5, 'F')

    doc.setFont('times', 'bold')
    doc.text(amt(catAmt), mg + 105, y + 5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.muted)
    doc.text(`${pct.toFixed(1)}%`, mg + 140, y + 5)
    doc.text(String(catTxnCount[cat] ?? 0), mg + 164, y + 5)

    y += 7.5
  })

  // Summary row
  guard(8)
  doc.setFillColor(...C.light)
  doc.rect(mg, y, cW, 7.5, 'F')
  doc.setFontSize(9)
  doc.setFont('times', 'bold')
  doc.setTextColor(...C.text)
  doc.text('TOTAL', mg + 9, y + 5)
  doc.text(amt(catTotal), mg + 105, y + 5)
  doc.setFont('helvetica', 'normal')
  y += 10

  // ── AI INSIGHTS ────────────────────────────────────────────────────────────────
  const active = insights.filter((i) => !i.dismissed)
  if (active.length > 0) {
    newPage()
    sectionHeading('AI Insights')

    const INSIGHT_ICON: Record<string, string> = {
      subscription: '[SUB]',
      anomaly:      '[!]',
      trend:        '[~]',
      savings_tip:  '[*]',
      cc_health:    '[OK]',
    }

    for (const ins of active) {
      const iColor = INSIGHT_COLORS[ins.insight_type] ?? C.accent
      const bodyLines = doc.splitTextToSize(safe(ins.body), cW - 12)
      const cardH = Math.max(16, 11 + bodyLines.length * 4.5)
      guard(cardH + 5)

      // Card background
      doc.setFillColor(...C.offwhite)
      doc.roundedRect(mg, y, cW, cardH, 2, 2, 'F')

      // Accent left stripe
      doc.setFillColor(...iColor)
      doc.roundedRect(mg, y, 4, cardH, 1, 1, 'F')

      // Title
      doc.setFontSize(9.5)
      doc.setFont('times', 'bold')
      doc.setTextColor(...iColor)
      doc.text(safe(ins.title), mg + 8, y + 7)

      // Severity badge
      const sevColor = ins.severity === 'critical' ? C.red : ins.severity === 'warning' ? C.amber : C.muted
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...sevColor)
      doc.text(ins.severity.toUpperCase(), mg + cW - 4, y + 7, { align: 'right' })

      // Body
      doc.setFontSize(8.5)
      doc.setTextColor(...C.text)
      doc.text(bodyLines, mg + 8, y + 13)

      // Related amount / merchant
      if (ins.related_amount > 0 || ins.related_merchant) {
        doc.setFontSize(7.5)
        doc.setFont('times', 'bold')
        doc.setTextColor(...C.muted)
        const meta = [
          ins.related_amount > 0 ? amt(ins.related_amount) : '',
          ins.related_merchant ? safe(ins.related_merchant) : '',
        ].filter(Boolean).join('  ·  ')
        if (meta) doc.text(meta, mg + 8, y + cardH - 3.5)
      }

      y += cardH + 4
    }
  }

  // ── ALL TRANSACTIONS ──────────────────────────────────────────────────────────
  newPage()
  sectionHeading('All Transactions')

  const allTxns = statements
    .flatMap((s) =>
      s.transactions.map((t) => ({ ...t, stmtLabel: s.account_label, bank: s.bank }))
    )
    .sort((a, b) => (a.txn_date ?? '').localeCompare(b.txn_date ?? ''))

  // Table header
  doc.setFillColor(...C.text)
  doc.rect(mg, y, cW, 8, 'F')
  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text('DATE',      mg + 2,   y + 5.2)
  doc.text('MERCHANT',  mg + 22,  y + 5.2)
  doc.text('CATEGORY',  mg + 100, y + 5.2)
  doc.text('AMOUNT',    mg + 138, y + 5.2)
  doc.text('TYPE',      mg + 163, y + 5.2)
  y += 8

  allTxns.forEach((txn, idx) => {
    guard(7)
    if (idx % 2 === 0) {
      doc.setFillColor(...C.offwhite)
      doc.rect(mg, y, cW, 6.5, 'F')
    }

    // Category color micro-dot
    const tc = CAT_COLORS[txn.category] ?? C.muted
    doc.setFillColor(...tc)
    doc.circle(mg + 17.5, y + 3.3, 1.2, 'F')

    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.muted)
    doc.text((txn.txn_date ?? '').slice(5), mg + 2, y + 4.5)

    doc.setTextColor(...C.text)
    doc.text(safe(txn.merchant_name || txn.description).slice(0, 36), mg + 22, y + 4.5)

    doc.setTextColor(...C.muted)
    doc.text(safe(txn.category).slice(0, 16), mg + 100, y + 4.5)

    const amtTxt = amt(txn.amount)
    if (txn.txn_type === 'credit') {
      doc.setTextColor(...C.green)
    } else {
      doc.setTextColor(...C.text)
    }
    doc.setFont('times', 'bold')
    doc.text(amtTxt, mg + 138, y + 4.5)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.muted)
    doc.text(txn.txn_type, mg + 163, y + 4.5)

    y += 6.5
  })

  // ── FOOTER on every page ──────────────────────────────────────────────────────
  const totalPages = doc.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.subtle)
    doc.text(`SpendDash  ·  ${periodStr}`, mg, H - 7)
    doc.text(`${p} / ${totalPages}`, W - mg, H - 7, { align: 'right' })
  }

  const fileDate = allDates[0]?.slice(0, 7) ?? 'report'
  doc.save(`spenddash-${fileDate}.pdf`)
}
