'use client'

import type { ParsedStatement, AIInsight, CCSummary, SavingsSummary } from '@/types'
import { formatINR, formatDate } from './utils'

// Colour palette for white-background PDF (prints cleanly, easy to read on screen)
const C = {
  white:   [255, 255, 255] as [number, number, number],
  bg:      [248, 250, 252] as [number, number, number],  // very light blue-grey for alternating rows
  border:  [226, 232, 240] as [number, number, number],
  text:    [15,  23,  42]  as [number, number, number],  // near-black
  muted:   [100, 116, 139] as [number, number, number],
  accent:  [13,  148, 136] as [number, number, number],  // teal
  green:   [22,  163, 74]  as [number, number, number],
  red:     [220, 38,  38]  as [number, number, number],
  amber:   [217, 119, 6]   as [number, number, number],
  tealBg:  [20,  184, 166] as [number, number, number],  // cover accent
}

export async function exportPDF(
  statements: ParsedStatement[],
  insights: AIInsight[]
): Promise<void> {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = 210
  const pageH = 297
  const margin = 16
  const contentW = pageW - margin * 2
  let y = margin

  function newPage() {
    doc.addPage()
    doc.setFillColor(...C.white)
    doc.rect(0, 0, pageW, pageH, 'F')
    y = margin
  }

  function checkNewPage(needed = 20) {
    if (y + needed > pageH - margin) newPage()
  }

  function sectionHeading(text: string) {
    checkNewPage(14)
    doc.setFontSize(15)
    doc.setTextColor(...C.accent)
    doc.setFont('helvetica', 'bold')
    doc.text(text, margin, y)
    y += 5
    doc.setDrawColor(...C.accent)
    doc.setLineWidth(0.4)
    doc.line(margin, y, margin + contentW, y)
    y += 5
    doc.setFont('helvetica', 'normal')
  }

  function label(text: string) {
    checkNewPage(6)
    doc.setFontSize(8)
    doc.setTextColor(...C.muted)
    doc.text(text, margin, y)
  }

  function value(text: string, x: number, color: [number, number, number] = C.text) {
    doc.setFontSize(10)
    doc.setTextColor(...color)
    doc.setFont('helvetica', 'bold')
    doc.text(text, x, y)
    doc.setFont('helvetica', 'normal')
    y += 6
  }

  function bodyText(text: string, size = 9.5, color: [number, number, number] = C.text) {
    checkNewPage(7)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(text, contentW)
    doc.text(lines, margin, y)
    y += lines.length * size * 0.42 + 2
  }

  function kv(k: string, v: string, vColor: [number, number, number] = C.text) {
    checkNewPage(6)
    doc.setFontSize(9)
    doc.setTextColor(...C.muted)
    doc.text(k, margin, y)
    doc.setTextColor(...vColor)
    doc.setFont('helvetica', 'bold')
    doc.text(v, margin + 50, y)
    doc.setFont('helvetica', 'normal')
    y += 5.5
  }

  // ─── COVER PAGE ────────────────────────────────────────────────────────────
  doc.setFillColor(...C.white)
  doc.rect(0, 0, pageW, pageH, 'F')

  // Teal header bar
  doc.setFillColor(...C.tealBg)
  doc.rect(0, 0, pageW, 55, 'F')

  doc.setFontSize(36)
  doc.setTextColor(...C.white)
  doc.setFont('helvetica', 'bold')
  doc.text('Spend Dash', pageW / 2, 30, { align: 'center' })
  doc.setFontSize(13)
  doc.setFont('helvetica', 'normal')
  doc.text('Personal Financial Report', pageW / 2, 44, { align: 'center' })

  if (statements.length > 0) {
    const allDates = statements.flatMap((s) => [s.period_start, s.period_end]).filter(Boolean).sort()
    const periodStr = allDates.length >= 2
      ? `${formatDate(allDates[0])} – ${formatDate(allDates[allDates.length - 1])}`
      : allDates[0] ? formatDate(allDates[0]) : 'Unknown Period'

    doc.setFontSize(20)
    doc.setTextColor(...C.text)
    doc.setFont('helvetica', 'bold')
    doc.text(periodStr, pageW / 2, 90, { align: 'center' })

    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.muted)
    doc.text(`${statements.length} statement${statements.length !== 1 ? 's' : ''}`, pageW / 2, 100, { align: 'center' })
  }

  // Summary boxes on cover
  let totalCredits = 0, totalDebits = 0
  for (const stmt of statements) {
    const s = stmt.summary as SavingsSummary & CCSummary
    totalCredits += s.total_credits ?? 0
    totalDebits += s.total_debits ?? 0
  }
  const net = totalCredits - totalDebits

  const boxY = 120
  const boxW = 54
  const boxGap = 6
  const boxX = [margin, margin + boxW + boxGap, margin + (boxW + boxGap) * 2]

  const boxes = [
    { label: 'Total Credits', value: formatINR(totalCredits), color: C.green },
    { label: 'Total Debits',  value: formatINR(totalDebits),  color: C.red   },
    { label: 'Net Flow',      value: formatINR(Math.abs(net)), color: net >= 0 ? C.accent : C.red },
  ]

  for (let i = 0; i < 3; i++) {
    doc.setFillColor(...C.bg)
    doc.roundedRect(boxX[i], boxY, boxW, 28, 3, 3, 'F')
    doc.setFontSize(8)
    doc.setTextColor(...C.muted)
    doc.text(boxes[i].label, boxX[i] + boxW / 2, boxY + 8, { align: 'center' })
    doc.setFontSize(13)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...boxes[i].color)
    doc.text(boxes[i].value, boxX[i] + boxW / 2, boxY + 20, { align: 'center' })
    doc.setFont('helvetica', 'normal')
  }

  doc.setFontSize(8)
  doc.setTextColor(...C.muted)
  doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, pageW / 2, pageH - 12, { align: 'center' })

  // ─── FINANCIAL SUMMARY ─────────────────────────────────────────────────────
  newPage()
  sectionHeading('Financial Summary')

  for (const stmt of statements) {
    checkNewPage(36)
    // Statement header row
    doc.setFillColor(...C.bg)
    doc.roundedRect(margin, y, contentW, 8, 2, 2, 'F')
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...C.text)
    doc.text(stmt.account_label, margin + 3, y + 5.5)
    const typeLabel = stmt.account_type === 'credit_card' ? 'Credit Card' : 'Savings'
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...C.muted)
    doc.text(`${stmt.bank}  ·  ${typeLabel}  ·  ${formatDate(stmt.period_start)} – ${formatDate(stmt.period_end)}`, margin + contentW - 3, y + 5.5, { align: 'right' })
    y += 12

    if (stmt.account_type === 'savings') {
      const s = stmt.summary as SavingsSummary
      kv('Opening Balance', formatINR(s.opening_balance ?? 0))
      kv('Closing Balance', formatINR(s.closing_balance ?? 0))
      kv('Credits', formatINR(s.total_credits ?? 0), C.green)
      kv('Debits',  formatINR(s.total_debits ?? 0),  C.red)
    } else {
      const s = stmt.summary as CCSummary
      kv('Credit Limit',    formatINR(s.credit_limit ?? 0))
      kv('Outstanding',     formatINR(s.total_outstanding ?? 0), C.red)
      kv('Minimum Due',     `${formatINR(s.minimum_due ?? 0)} by ${formatDate(s.due_date ?? '')}`, C.amber)
      kv('Cashback Earned', formatINR(s.cashback_earned ?? 0), C.green)
      if (s.rewards_points) kv('Rewards Points', `${s.rewards_points}`)
    }
    y += 4
  }

  // ─── SPEND BY CATEGORY ─────────────────────────────────────────────────────
  newPage()
  sectionHeading('Spend by Category')

  const categoryMap: Record<string, number> = {}
  let totalSpend = 0
  for (const stmt of statements) {
    for (const txn of stmt.transactions) {
      if (txn.is_cc_bill_payment || txn.txn_type === 'credit') continue
      categoryMap[txn.category] = (categoryMap[txn.category] ?? 0) + txn.amount
      totalSpend += txn.amount
    }
  }

  const sortedCats = Object.entries(categoryMap).sort(([, a], [, b]) => b - a)

  // Table header
  doc.setFillColor(...C.tealBg)
  doc.rect(margin, y, contentW, 7, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text('Category', margin + 3, y + 4.8)
  doc.text('Amount', margin + 110, y + 4.8)
  doc.text('Share', margin + 145, y + 4.8)
  y += 7

  sortedCats.forEach(([cat, amt], idx) => {
    checkNewPage(7)
    if (idx % 2 === 1) {
      doc.setFillColor(...C.bg)
      doc.rect(margin, y - 1, contentW, 7, 'F')
    }
    const pct = totalSpend > 0 ? ((amt / totalSpend) * 100).toFixed(1) : '0.0'
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.text)
    doc.text(cat, margin + 3, y + 4)
    doc.setFont('helvetica', 'bold')
    doc.text(formatINR(amt), margin + 110, y + 4)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.muted)
    doc.text(`${pct}%`, margin + 145, y + 4)
    y += 7
  })
  y += 4

  // Charts
  const categoryDonut = document.getElementById('category-donut-chart')
  if (categoryDonut) {
    try {
      const canvas = await html2canvas(categoryDonut, { backgroundColor: '#ffffff', scale: 2 })
      checkNewPage(80)
      const imgData = canvas.toDataURL('image/png')
      doc.addImage(imgData, 'PNG', margin, y, contentW * 0.55, 65)
      y += 70
    } catch { /* chart capture failed */ }
  }

  const monthlyBar = document.getElementById('monthly-bar-chart')
  if (monthlyBar) {
    try {
      const canvas = await html2canvas(monthlyBar, { backgroundColor: '#ffffff', scale: 2 })
      checkNewPage(80)
      const imgData = canvas.toDataURL('image/png')
      doc.addImage(imgData, 'PNG', margin, y, contentW, 68)
      y += 73
    } catch { /* chart capture failed */ }
  }

  // ─── AI INSIGHTS ───────────────────────────────────────────────────────────
  newPage()
  sectionHeading('AI Insights')

  const activeInsights = insights.filter((i) => !i.dismissed)
  for (const insight of activeInsights) {
    checkNewPage(28)
    const sColor: [number, number, number] =
      insight.severity === 'critical' ? C.red :
      insight.severity === 'warning'  ? C.amber : C.accent

    // Insight card background
    doc.setFillColor(...C.bg)
    const bodyLines = doc.splitTextToSize(insight.body, contentW - 6)
    const cardH = 12 + bodyLines.length * 4.5
    doc.roundedRect(margin, y, contentW, cardH, 2, 2, 'F')
    doc.setFillColor(...sColor)
    doc.roundedRect(margin, y, 3, cardH, 1, 1, 'F')

    doc.setFontSize(9.5)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...sColor)
    doc.text(insight.title, margin + 6, y + 6)

    doc.setFontSize(8.5)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.text)
    doc.text(bodyLines, margin + 6, y + 11)

    y += cardH + 4
  }

  // ─── ALL TRANSACTIONS ──────────────────────────────────────────────────────
  newPage()
  sectionHeading('All Transactions')

  const allTxns = statements
    .flatMap((s) => s.transactions.map((t) => ({ ...t, account: s.account_label })))
    .sort((a, b) => a.txn_date.localeCompare(b.txn_date))

  // Table header
  doc.setFillColor(...C.tealBg)
  doc.rect(margin, y, contentW, 7, 'F')
  doc.setFontSize(8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...C.white)
  doc.text('Date',     margin + 2,   y + 4.8)
  doc.text('Merchant', margin + 22,  y + 4.8)
  doc.text('Category', margin + 95,  y + 4.8)
  doc.text('Amount',   margin + 133, y + 4.8)
  doc.text('Type',     margin + 157, y + 4.8)
  y += 7

  allTxns.forEach((txn, idx) => {
    checkNewPage(6)
    if (idx % 2 === 1) {
      doc.setFillColor(...C.bg)
      doc.rect(margin, y - 0.5, contentW, 6, 'F')
    }
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'normal')

    doc.setTextColor(...C.muted)
    doc.text((txn.txn_date ?? '').slice(5), margin + 2, y + 4)

    doc.setTextColor(...C.text)
    doc.text((txn.merchant_name || txn.description).slice(0, 36), margin + 22, y + 4)

    doc.setTextColor(...C.muted)
    doc.text(txn.category.slice(0, 18), margin + 95, y + 4)

    const amtColor = txn.txn_type === 'credit' ? C.green : C.red
    doc.setTextColor(...amtColor)
    doc.setFont('helvetica', 'bold')
    doc.text(formatINR(txn.amount), margin + 133, y + 4)

    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...C.muted)
    doc.text(txn.txn_type, margin + 157, y + 4)

    y += 6
  })

  const allDates = statements.flatMap((s) => [s.period_start, s.period_end]).filter(Boolean).sort()
  const periodStr = allDates.length >= 2
    ? `${allDates[0]}_${allDates[allDates.length - 1]}`
    : allDates[0] ?? 'report'

  doc.save(`spend-dash-report-${periodStr}.pdf`)
}
