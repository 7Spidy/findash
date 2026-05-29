'use client'

import type { ParsedStatement, AIInsight, CCSummary, SavingsSummary } from '@/types'
import { formatINR, formatDate } from './utils'

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
  const margin = 15
  const contentW = pageW - margin * 2
  let y = margin

  function checkNewPage(needed = 20) {
    if (y + needed > pageH - margin) {
      doc.addPage()
      y = margin
    }
  }

  function heading(text: string, size = 16, color: [number, number, number] = [20, 184, 166]) {
    checkNewPage(12)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    doc.text(text, margin, y)
    y += size * 0.5
  }

  function body(text: string, size = 10, color: [number, number, number] = [245, 245, 245]) {
    checkNewPage(8)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const lines = doc.splitTextToSize(text, contentW)
    doc.text(lines, margin, y)
    y += lines.length * size * 0.4 + 2
  }

  function divider() {
    checkNewPage(6)
    doc.setDrawColor(36, 36, 36)
    doc.line(margin, y, pageW - margin, y)
    y += 4
  }

  // --- COVER PAGE ---
  doc.setFillColor(15, 15, 15)
  doc.rect(0, 0, pageW, pageH, 'F')

  doc.setFontSize(32)
  doc.setTextColor(20, 184, 166)
  doc.text('Spend Dash', pageW / 2, 80, { align: 'center' })

  doc.setFontSize(14)
  doc.setTextColor(245, 245, 245)
  doc.text('Personal Financial Report', pageW / 2, 95, { align: 'center' })

  if (statements.length > 0) {
    const allDates = statements.flatMap((s) => [s.period_start, s.period_end]).filter(Boolean).sort()
    const periodStr = allDates.length >= 2
      ? `${formatDate(allDates[0])} – ${formatDate(allDates[allDates.length - 1])}`
      : allDates[0] ? formatDate(allDates[0]) : 'Unknown Period'
    doc.setFontSize(11)
    doc.setTextColor(136, 136, 136)
    doc.text(periodStr, pageW / 2, 108, { align: 'center' })
    doc.text(`${statements.length} statement${statements.length > 1 ? 's' : ''}`, pageW / 2, 116, { align: 'center' })
  }

  doc.setFontSize(9)
  doc.setTextColor(100, 100, 100)
  doc.text(`Generated ${new Date().toLocaleString('en-IN')}`, pageW / 2, pageH - 20, { align: 'center' })

  // --- FINANCIAL SUMMARY ---
  doc.addPage()
  doc.setFillColor(15, 15, 15)
  doc.rect(0, 0, pageW, pageH, 'F')
  y = margin

  heading('Financial Summary', 18)
  y += 4
  divider()

  let totalCredits = 0, totalDebits = 0
  for (const stmt of statements) {
    const s = stmt.summary as SavingsSummary & CCSummary
    totalCredits += s.total_credits ?? 0
    totalDebits += s.total_debits ?? 0
  }

  body(`Total Credits: ${formatINR(totalCredits)}`, 11, [34, 197, 94])
  body(`Total Debits:  ${formatINR(totalDebits)}`, 11, [239, 68, 68])
  const net = totalCredits - totalDebits
  body(`Net Flow:      ${formatINR(net)}`, 11, net >= 0 ? [20, 184, 166] : [239, 68, 68])
  y += 4

  // Per-statement summary
  for (const stmt of statements) {
    checkNewPage(30)
    heading(stmt.account_label, 12, [245, 245, 245])
    body(`Bank: ${stmt.bank} | Type: ${stmt.account_type === 'credit_card' ? 'Credit Card' : 'Savings'}`)
    body(`Period: ${formatDate(stmt.period_start)} – ${formatDate(stmt.period_end)}`)

    if (stmt.account_type === 'savings') {
      const s = stmt.summary as SavingsSummary
      body(`Opening Balance: ${formatINR(s.opening_balance ?? 0)}`)
      body(`Closing Balance: ${formatINR(s.closing_balance ?? 0)}`)
      body(`Credits: ${formatINR(s.total_credits ?? 0)} | Debits: ${formatINR(s.total_debits ?? 0)}`)
    } else {
      const s = stmt.summary as CCSummary
      body(`Outstanding: ${formatINR(s.total_outstanding ?? 0)} / Limit: ${formatINR(s.credit_limit ?? 0)}`)
      body(`Min Due: ${formatINR(s.minimum_due ?? 0)} by ${formatDate(s.due_date ?? '')}`)
      body(`Cashback: ${formatINR(s.cashback_earned ?? 0)} | Points: ${s.rewards_points ?? 0}`)
    }
    y += 3
  }

  // --- SPEND BY CATEGORY ---
  doc.addPage()
  doc.setFillColor(15, 15, 15)
  doc.rect(0, 0, pageW, pageH, 'F')
  y = margin

  heading('Spend by Category', 18)
  y += 4
  divider()

  const categoryMap: Record<string, number> = {}
  let totalSpend = 0
  for (const stmt of statements) {
    for (const txn of stmt.transactions) {
      if (txn.is_cc_bill_payment || txn.txn_type === 'credit') continue
      categoryMap[txn.category] = (categoryMap[txn.category] ?? 0) + txn.amount
      totalSpend += txn.amount
    }
  }

  const sortedCategories = Object.entries(categoryMap).sort(([, a], [, b]) => b - a)
  for (const [cat, amt] of sortedCategories) {
    checkNewPage(8)
    const pct = totalSpend > 0 ? ((amt / totalSpend) * 100).toFixed(1) : '0.0'
    doc.setFontSize(10)
    doc.setTextColor(245, 245, 245)
    doc.text(cat, margin, y)
    doc.text(formatINR(amt), margin + 80, y)
    doc.setTextColor(136, 136, 136)
    doc.text(`${pct}%`, margin + 120, y)
    y += 6
  }

  // Capture charts if available
  const categoryDonut = document.getElementById('category-donut-chart')
  if (categoryDonut) {
    try {
      const canvas = await html2canvas(categoryDonut, { backgroundColor: '#1a1a1a', scale: 1.5 })
      checkNewPage(80)
      const imgData = canvas.toDataURL('image/png')
      doc.addImage(imgData, 'PNG', margin, y, contentW * 0.6, 70)
      y += 75
    } catch { /* chart capture failed */ }
  }

  const monthlyBar = document.getElementById('monthly-bar-chart')
  if (monthlyBar) {
    try {
      const canvas = await html2canvas(monthlyBar, { backgroundColor: '#1a1a1a', scale: 1.5 })
      checkNewPage(80)
      const imgData = canvas.toDataURL('image/png')
      doc.addImage(imgData, 'PNG', margin, y, contentW, 70)
      y += 75
    } catch { /* chart capture failed */ }
  }

  // --- AI INSIGHTS ---
  doc.addPage()
  doc.setFillColor(15, 15, 15)
  doc.rect(0, 0, pageW, pageH, 'F')
  y = margin

  heading('AI Insights', 18)
  y += 4
  divider()

  const activeInsights = insights.filter((i) => !i.dismissed)
  for (const insight of activeInsights) {
    checkNewPage(25)
    const severityColor: [number, number, number] =
      insight.severity === 'critical' ? [239, 68, 68] :
      insight.severity === 'warning'  ? [245, 158, 11] :
      [20, 184, 166]

    heading(insight.title, 11, severityColor)
    body(insight.body, 9, [200, 200, 200])
    y += 2
  }

  // --- TRANSACTION LIST ---
  doc.addPage()
  doc.setFillColor(15, 15, 15)
  doc.rect(0, 0, pageW, pageH, 'F')
  y = margin

  heading('All Transactions', 18)
  y += 4
  divider()

  const allTxns = statements
    .flatMap((s) => s.transactions.map((t) => ({ ...t, account: s.account_label })))
    .sort((a, b) => a.txn_date.localeCompare(b.txn_date))

  doc.setFontSize(8)
  doc.setTextColor(136, 136, 136)
  doc.text('Date', margin, y)
  doc.text('Merchant', margin + 20, y)
  doc.text('Category', margin + 90, y)
  doc.text('Amount', margin + 130, y)
  doc.text('Type', margin + 155, y)
  y += 5
  divider()

  for (const txn of allTxns) {
    checkNewPage(6)
    doc.setFontSize(7.5)
    doc.setTextColor(txn.txn_type === 'credit' ? 34 : 245, txn.txn_type === 'credit' ? 197 : 245, txn.txn_type === 'credit' ? 94 : 245)
    doc.text((txn.txn_date ?? '').slice(5), margin, y)
    doc.setTextColor(245, 245, 245)
    doc.text((txn.merchant_name || txn.description).slice(0, 35), margin + 20, y)
    doc.setTextColor(136, 136, 136)
    doc.text(txn.category.slice(0, 20), margin + 90, y)
    doc.setTextColor(txn.txn_type === 'credit' ? 34 : 239, txn.txn_type === 'credit' ? 197 : 68, txn.txn_type === 'credit' ? 94 : 68)
    doc.text(formatINR(txn.amount), margin + 130, y)
    doc.setTextColor(136, 136, 136)
    doc.text(txn.txn_type, margin + 155, y)
    y += 5
  }

  const allDates = statements.flatMap((s) => [s.period_start, s.period_end]).filter(Boolean).sort()
  const periodStr = allDates.length >= 2
    ? `${allDates[0]}_${allDates[allDates.length - 1]}`
    : allDates[0] ?? 'report'

  doc.save(`spend-dash-report-${periodStr}.pdf`)
}
