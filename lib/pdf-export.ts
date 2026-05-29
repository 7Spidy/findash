'use client'

import type { ParsedStatement, AIInsight, CCSummary, SavingsSummary } from '@/types'
import { formatINR, formatDate } from './utils'

// jsPDF uses Helvetica (ISO-8859-1) — strip non-ASCII before rendering
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

const C = {
  white:  [255, 255, 255] as [number, number, number],
  bg:     [250, 248, 243] as [number, number, number],  // warm parchment
  bg2:    [243, 240, 233] as [number, number, number],  // slightly darker row bg
  border: [230, 224, 212] as [number, number, number],
  text:   [15,  23,  42]  as [number, number, number],
  muted:  [107, 114, 128] as [number, number, number],
  accent: [123, 63,  0]   as [number, number, number],  // warm brown
  green:  [5,   150, 105] as [number, number, number],
  red:    [220, 38,  38]  as [number, number, number],
  amber:  [217, 119, 6]   as [number, number, number],
  blue:   [37,  99,  235] as [number, number, number],
}

export async function exportPDF(
  statements: ParsedStatement[],
  insights: AIInsight[]
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const mg = 16
  const cW = pageW - mg * 2
  let y = mg

  // ── helpers ──────────────────────────────────────────────────────────────────

  function newPage() {
    doc.addPage()
    doc.setFillColor(...C.white)
    doc.rect(0, 0, pageW, pageH, 'F')
    y = mg
  }

  function guard(need = 18) {
    if (y + need > pageH - mg) newPage()
  }

  function heading(text: string) {
    guard(16)
    doc.setFontSize(14)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.accent)
    doc.text(text, mg, y)
    y += 4
    doc.setDrawColor(...C.accent)
    doc.setLineWidth(0.35)
    doc.line(mg, y, mg + cW, y)
    y += 6
    doc.setFont('helvetica', 'normal')
  }

  function kv(k: string, v: string, vColor: [number, number, number] = C.text, xOffset = 55) {
    guard(6)
    doc.setFontSize(8.5)
    doc.setTextColor(...C.muted)
    doc.setFont('helvetica', 'normal')
    doc.text(k, mg, y)
    doc.setTextColor(...vColor)
    doc.setFont('helvetica', 'bold')
    doc.text(v, mg + xOffset, y)
    doc.setFont('helvetica', 'normal')
    y += 5.5
  }

  function bodyText(text: string, size = 9, color: [number, number, number] = C.text) {
    guard(8)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(text, cW)
    doc.text(lines, mg, y)
    y += lines.length * size * 0.42 + 2
  }

  function tableHeader(cols: { label: string; x: number }[]) {
    doc.setFillColor(...C.accent)
    doc.rect(mg, y, cW, 7, 'F')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.white)
    cols.forEach(({ label, x }) => doc.text(label, mg + x, y + 4.8))
    y += 7
    doc.setFont('helvetica', 'normal')
  }

  // ── COVER PAGE ────────────────────────────────────────────────────────────────
  doc.setFillColor(...C.white)
  doc.rect(0, 0, pageW, pageH, 'F')

  // Header bar
  doc.setFillColor(...C.accent)
  doc.rect(0, 0, pageW, 58, 'F')

  doc.setFontSize(32)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text('SpendDash', pageW / 2, 28, { align: 'center' })
  doc.setFontSize(12)
  doc.setFont('helvetica', 'normal')
  doc.text('Personal Financial Report', pageW / 2, 43, { align: 'center' })

  const allDates = statements.flatMap((s) => [s.period_start, s.period_end]).filter(Boolean).sort()
  const periodStr =
    allDates.length >= 2
      ? `${formatDate(allDates[0])} to ${formatDate(allDates[allDates.length - 1])}`
      : allDates[0]
        ? formatDate(allDates[0])
        : 'Unknown Period'

  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.text)
  doc.text(periodStr, pageW / 2, 88, { align: 'center' })

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...C.muted)
  doc.text(
    `${statements.length} statement${statements.length !== 1 ? 's' : ''}`,
    pageW / 2,
    98,
    { align: 'center' }
  )

  // Summary boxes
  let totalCredits = 0
  let totalDebits = 0
  let totalSpend = 0
  for (const stmt of statements) {
    const s = stmt.summary as SavingsSummary & CCSummary
    totalCredits += s.total_credits ?? 0
    totalDebits += s.total_debits ?? 0
  }
  for (const stmt of statements) {
    for (const t of stmt.transactions) {
      if (!t.is_cc_bill_payment && t.txn_type === 'debit') totalSpend += t.amount
    }
  }
  const net = totalCredits - totalDebits

  const boxW = 54
  const boxGap = 6
  const boxY = 118
  const boxXs = [mg, mg + boxW + boxGap, mg + (boxW + boxGap) * 2]
  const boxes = [
    { label: 'Total Spend',  val: amt(totalSpend),       color: C.red    },
    { label: 'Total Income', val: amt(totalCredits),     color: C.green  },
    { label: 'Net Flow',     val: (net >= 0 ? '+' : '-') + amt(Math.abs(net)), color: net >= 0 ? C.green : C.red },
  ]
  boxes.forEach((b, i) => {
    doc.setFillColor(...C.bg2)
    doc.roundedRect(boxXs[i], boxY, boxW, 30, 3, 3, 'F')
    doc.setDrawColor(...C.border)
    doc.setLineWidth(0.3)
    doc.roundedRect(boxXs[i], boxY, boxW, 30, 3, 3, 'S')
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.muted)
    doc.text(b.label, boxXs[i] + boxW / 2, boxY + 9, { align: 'center' })
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...b.color)
    doc.text(b.val, boxXs[i] + boxW / 2, boxY + 22, { align: 'center' })
    doc.setFont('helvetica', 'normal')
  })

  doc.setFontSize(7.5)
  doc.setTextColor(...C.muted)
  doc.text(
    `Generated on ${new Date().toLocaleString('en-IN')}  •  Data stays in your browser — never uploaded`,
    pageW / 2,
    pageH - 12,
    { align: 'center' }
  )

  // ── PAGE 2: FINANCIAL SUMMARY ─────────────────────────────────────────────────
  newPage()
  heading('Financial Summary')

  for (const stmt of statements) {
    guard(40)
    // Statement header band
    doc.setFillColor(...C.bg2)
    doc.roundedRect(mg, y, cW, 9, 2, 2, 'F')
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.text)
    doc.text(safe(stmt.account_label), mg + 3, y + 6)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.muted)
    const typeLabel = stmt.account_type === 'credit_card' ? 'Credit Card' : 'Savings'
    doc.text(
      `${safe(stmt.bank)}  ·  ${typeLabel}  ·  ${formatDate(stmt.period_start)} – ${formatDate(stmt.period_end)}`,
      mg + cW - 3,
      y + 6,
      { align: 'right' }
    )
    y += 14

    if (stmt.account_type === 'savings') {
      const s = stmt.summary as SavingsSummary
      kv('Opening Balance', amt(s.opening_balance ?? 0))
      kv('Closing Balance', amt(s.closing_balance ?? 0))
      kv('Total Credits',   amt(s.total_credits ?? 0), C.green)
      kv('Total Debits',    amt(s.total_debits ?? 0),  C.red)
    } else {
      const s = stmt.summary as CCSummary
      kv('Credit Limit',    amt(s.credit_limit ?? 0))
      kv('Outstanding',     amt(s.total_outstanding ?? 0), C.red)
      kv('Minimum Due',     `${amt(s.minimum_due ?? 0)}  by  ${formatDate(s.due_date ?? '')}`, C.amber)
      kv('Cashback Earned', amt(s.cashback_earned ?? 0), C.green)
      if ((s.rewards_points ?? 0) > 0) kv('Reward Points', `${s.rewards_points}`)
    }
    y += 6
  }

  // ── SPEND BY CATEGORY ─────────────────────────────────────────────────────────
  newPage()
  heading('Spend by Category')

  const catMap: Record<string, number> = {}
  for (const stmt of statements) {
    for (const t of stmt.transactions) {
      if (t.is_cc_bill_payment || t.txn_type === 'credit') continue
      catMap[t.category] = (catMap[t.category] ?? 0) + t.amount
    }
  }
  const sortedCats = Object.entries(catMap).sort(([, a], [, b]) => b - a)

  tableHeader([
    { label: 'Category',   x: 3   },
    { label: 'Amount',     x: 110 },
    { label: '% of Spend', x: 145 },
    { label: 'Txns',       x: 168 },
  ])

  // Count transactions per category
  const catTxnCount: Record<string, number> = {}
  for (const stmt of statements) {
    for (const t of stmt.transactions) {
      if (t.is_cc_bill_payment || t.txn_type === 'credit') continue
      catTxnCount[t.category] = (catTxnCount[t.category] ?? 0) + 1
    }
  }

  sortedCats.forEach(([cat, catAmt], idx) => {
    guard(7)
    if (idx % 2 === 1) {
      doc.setFillColor(...C.bg)
      doc.rect(mg, y - 0.5, cW, 7, 'F')
    }
    const pct = totalSpend > 0 ? ((catAmt / totalSpend) * 100).toFixed(1) : '0.0'
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.text)
    doc.text(cat, mg + 3, y + 4.5)
    doc.setFont('helvetica', 'bold')
    doc.text(amt(catAmt), mg + 110, y + 4.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.muted)
    doc.text(`${pct}%`, mg + 145, y + 4.5)
    doc.text(String(catTxnCount[cat] ?? 0), mg + 168, y + 4.5)
    y += 7
  })
  y += 6

  // ── AI INSIGHTS ────────────────────────────────────────────────────────────────
  if (insights.length > 0) {
    newPage()
    heading('AI Insights')

    const insightColor = (type: string): [number, number, number] => {
      if (type === 'anomaly') return C.red
      if (type === 'subscription') return C.amber
      if (type === 'cc_health') return C.green
      if (type === 'savings_tip') return C.blue
      return C.accent
    }

    const active = insights.filter((i) => !i.dismissed)
    for (const ins of active) {
      const iColor = insightColor(ins.insight_type)
      const bodyLines = doc.splitTextToSize(safe(ins.body), cW - 8)
      const cardH = 13 + bodyLines.length * 4.8
      guard(cardH + 4)

      doc.setFillColor(...C.bg)
      doc.roundedRect(mg, y, cW, cardH, 2, 2, 'F')
      doc.setFillColor(...iColor)
      doc.roundedRect(mg, y, 3.5, cardH, 1, 1, 'F')

      doc.setFontSize(9.5)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...iColor)
      doc.text(safe(ins.title), mg + 7, y + 7)

      doc.setFontSize(8.5)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...C.text)
      doc.text(bodyLines, mg + 7, y + 13)

      if (ins.related_amount > 0) {
        doc.setFontSize(7.5)
        doc.setTextColor(...C.muted)
        doc.text(
          `${ins.insight_type === 'subscription' ? amt(ins.related_amount) + '/mo' : amt(ins.related_amount)}${ins.related_merchant ? '  ·  ' + safe(ins.related_merchant) : ''}`,
          mg + 7,
          y + cardH - 3.5
        )
      }
      y += cardH + 4
    }
  }

  // ── ALL TRANSACTIONS ──────────────────────────────────────────────────────────
  newPage()
  heading('All Transactions')

  const allTxns = statements
    .flatMap((s) =>
      s.transactions.map((t) => ({ ...t, stmtLabel: s.account_label, bank: s.bank }))
    )
    .sort((a, b) => (a.txn_date ?? '').localeCompare(b.txn_date ?? ''))

  tableHeader([
    { label: 'Date',     x: 2   },
    { label: 'Merchant', x: 22  },
    { label: 'Category', x: 98  },
    { label: 'Amount',   x: 136 },
    { label: 'Type',     x: 161 },
  ])

  allTxns.forEach((txn, idx) => {
    guard(6.5)
    if (idx % 2 === 1) {
      doc.setFillColor(...C.bg)
      doc.rect(mg, y - 0.5, cW, 6.5, 'F')
    }
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')

    doc.setTextColor(...C.muted)
    doc.text((txn.txn_date ?? '').slice(5), mg + 2, y + 4)

    doc.setTextColor(...C.text)
    doc.text(safe(txn.merchant_name || txn.description).slice(0, 38), mg + 22, y + 4)

    doc.setTextColor(...C.muted)
    doc.text(safe(txn.category).slice(0, 18), mg + 98, y + 4)

    doc.setTextColor(txn.txn_type === 'credit' ? C.green[0] : C.red[0], txn.txn_type === 'credit' ? C.green[1] : C.red[1], txn.txn_type === 'credit' ? C.green[2] : C.red[2])
    doc.setFont('helvetica', 'bold')
    doc.text(amt(txn.amount), mg + 136, y + 4)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.muted)
    doc.text(txn.txn_type, mg + 161, y + 4)

    y += 6.5
  })

  // ── FOOTER on last page ───────────────────────────────────────────────────────
  const totalPages = (doc as unknown as { getNumberOfPages(): number }).getNumberOfPages?.() ?? 1
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    doc.setFontSize(7)
    doc.setTextColor(...C.muted)
    doc.text(`SpendDash Report  ·  ${periodStr}`, mg, pageH - 8)
    doc.text(`Page ${p} of ${totalPages}`, pageW - mg, pageH - 8, { align: 'right' })
  }

  const fileDate = allDates[0] ? allDates[0].slice(0, 7) : 'report'
  doc.save(`spenddash-${fileDate}.pdf`)
}
