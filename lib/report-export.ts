import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

import { createDocx } from "./docx-export"
import { loadNanoBankLogo } from "./brand-logo"
import type { ProcurementRecord } from "./procurement-types"

/** Report periods supported by the shared PDF, DOCX, and XLSX pipeline. */
export type ReportPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "annual" | "custom"
export type ReportFormat = "pdf" | "docx" | "xlsx"

const iso = (date: Date) => date.toISOString().slice(0, 10)
const parseDate = (value: string) => new Date(`${value}T12:00:00`)
const money = (value: number, currency = "IDR") => new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(value)
const safeName = (value: string) => value.replace(/[^a-z0-9_-]+/gi, "_")

export function reportRange(period: ReportPeriod, anchor: string, customStart = "", customEnd = "") {
  if (period === "custom") return { start: customStart, end: customEnd, label: `${customStart || "awal"} s.d. ${customEnd || "akhir"}` }
  const date = parseDate(anchor)
  let start = new Date(date)
  let end = new Date(date)
  if (period === "weekly") {
    const offset = (date.getDay() + 6) % 7
    start.setDate(date.getDate() - offset)
    end.setDate(start.getDate() + 6)
  } else if (period === "monthly") {
    start = new Date(date.getFullYear(), date.getMonth(), 1, 12)
    end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 12)
  } else if (period === "quarterly") {
    const month = Math.floor(date.getMonth() / 3) * 3
    start = new Date(date.getFullYear(), month, 1, 12)
    end = new Date(date.getFullYear(), month + 3, 0, 12)
  } else if (period === "annual") {
    start = new Date(date.getFullYear(), 0, 1, 12)
    end = new Date(date.getFullYear(), 11, 31, 12)
  }
  const labels: Record<Exclude<ReportPeriod, "custom">, string> = { daily: "Harian", weekly: "Mingguan", monthly: "Bulanan", quarterly: "Triwulanan", annual: "Tahunan" }
  return { start: iso(start), end: iso(end), label: `${labels[period]} · ${iso(start)} s.d. ${iso(end)}` }
}

/** Filters only by request date; dashboard status filters stay a UI concern. */
export function filterReportRecords(records: ProcurementRecord[], period: ReportPeriod, anchor: string, customStart = "", customEnd = "") {
  const range = reportRange(period, anchor, customStart, customEnd)
  return { ...range, records: records.filter((record) => record.requestDate && (!range.start || record.requestDate >= range.start) && (!range.end || record.requestDate <= range.end)) }
}

function reportData(records: ProcurementRecord[]) {
  const counts = Object.fromEntries(["Upcoming", "Ongoing", "PO", "Complete", "Dropped"].map((status) => [status, records.filter((record) => record.status === status).length]))
  const expense = records.reduce<Record<string, number>>((result, record) => ({ ...result, [record.currency]: (result[record.currency] ?? 0) + record.poAmountIncl }), {})
  const efficiency = records.reduce<Record<string, number>>((result, record) => ({ ...result, [record.currency]: (result[record.currency] ?? 0) + record.efficiency }), {})
  const savingRate = Object.fromEntries(Object.keys({ ...expense, ...efficiency }).map((currency) => {
    const base = (expense[currency] ?? 0) + (efficiency[currency] ?? 0)
    return [currency, base ? ((efficiency[currency] ?? 0) / base) * 100 : 0]
  }))
  return { counts, expense, efficiency, savingRate }
}
const moneyBreakdown = (totals: Record<string, number>) => Object.entries(totals).filter(([, value]) => value).map(([currency, value]) => money(value, currency)).join(" · ") || money(0)

const headers = ["Tanggal", "Pengadaan", "Status", "Keterangan Status", "PIC", "Budget", "Metode", "Vendor", "Nomor PO", "Currency", "Expense Incl. PPN", "Efficiency Incl. PPN", "Saving %"]
const rows = (records: ProcurementRecord[]) => records.map((record) => [record.requestDate, record.description || record.itemName, record.status, record.statusNotes || "—", record.picName, record.budgetType || "—", record.procurementMethod, record.selectedVendor || "—", record.poNumber || "—", record.currency, record.poAmountIncl, record.efficiency, record.initialPriceExcl ? Math.max(0, ((record.initialPriceExcl - record.poAmountExcl) / record.initialPriceExcl) * 100) : 0])

/** Produces one equivalent report model in the requested document format. */
export async function createProcurementReport(records: ProcurementRecord[], label: string, format: ReportFormat) {
  const totals = reportData(records)
  const title = `Laporan Pengadaan · ${label}`
  const savingSummary = Object.entries(totals.savingRate).map(([currency, value]) => `${currency} ${value.toFixed(2)}%`).join(" · ") || "0.00%"
  const summary = ["NanoBank Syariah · Procurement Management Report", `Periode pelaporan: ${label}`, `Total pengadaan: ${records.length}`, `Expense incl. PPN: ${moneyBreakdown(totals.expense)}`, `Efficiency incl. PPN: ${moneyBreakdown(totals.efficiency)}`, `Saving: ${savingSummary}`, `Status: Upcoming ${totals.counts.Upcoming} · Ongoing ${totals.counts.Ongoing} · PO ${totals.counts.PO} · Complete ${totals.counts.Complete} · Dropped ${totals.counts.Dropped}`, "Dokumen internal · Disusun sebagai informasi manajemen dan jejak audit pengadaan."]
  const filename = `Laporan_Pengadaan_${safeName(label)}.${format}`

  if (format === "docx") return { blob: createDocx(title, summary, headers, rows(records).map((row) => row.map((value, index) => index === 10 || index === 11 ? money(Number(value), String(row[9])) : index === 12 ? `${Number(value).toFixed(2)}%` : value))), filename }
  if (format === "xlsx") {
    const workbook = XLSX.utils.book_new()
    const overviewRows: unknown[][] = [["NANOBANK SYARIAH"], [title], ["Dokumen Internal · Management Information"], [], ["Ringkasan", "Nilai", "Currency"], ["Total Pengadaan", records.length, ""], ...Object.entries(totals.expense).map(([currency, value]) => ["Expense Incl. PPN", value, currency]), ...Object.entries(totals.efficiency).map(([currency, value]) => ["Efficiency Incl. PPN", value, currency]), ...Object.entries(totals.savingRate).map(([currency, value]) => ["Saving", value / 100, currency]), ...Object.entries(totals.counts)]
    const overview = XLSX.utils.aoa_to_sheet(overviewRows)
    overview["!cols"] = [{ wch: 28 }, { wch: 24 }]
    for (let row = 5; row <= overviewRows.length; row++) if (overview[`B${row}`] && typeof overview[`B${row}`].v === "number") overview[`B${row}`].z = '#,##0'
    XLSX.utils.book_append_sheet(workbook, overview, "Ringkasan")
    const data = XLSX.utils.aoa_to_sheet([headers, ...rows(records)])
    data["!cols"] = [13, 36, 12, 30, 22, 14, 20, 24, 18, 10, 20, 20, 12].map((wch) => ({ wch }))
    for (let row = 2; row <= records.length + 1; row++) { for (const column of ["K", "L"]) if (data[`${column}${row}`]) data[`${column}${row}`].z = '#,##0'; if (data[`M${row}`]) data[`M${row}`].z = '0.00' }
    XLSX.utils.book_append_sheet(workbook, data, "Data Pengadaan")
    return { blob: new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), filename }
  }

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  pdf.setFillColor(8, 47, 99); pdf.rect(0, 0, 297, 29, "F"); pdf.setFillColor(115, 217, 75); pdf.rect(0, 27, 297, 2, "F")
  const logo = await loadNanoBankLogo()
  pdf.addImage(logo, "PNG", 244, 6, 43, 14)
  pdf.setTextColor(255, 255, 255); pdf.setFontSize(16); pdf.text("LAPORAN PENGADAAN", 14, 12); pdf.setFontSize(9); pdf.text(label, 14, 20)
  pdf.setTextColor(24, 36, 52); pdf.setFontSize(8); pdf.text(`Total: ${records.length}`, 14, 37); pdf.text(`Expense: ${moneyBreakdown(totals.expense)}`, 45, 37); pdf.text(`Efficiency: ${moneyBreakdown(totals.efficiency)}`, 145, 37); pdf.text(`Saving: ${savingSummary}`, 240, 37)
  autoTable(pdf, { startY: 43, margin: { left: 8, right: 8, bottom: 10 }, head: [headers], body: rows(records).map((row) => row.map((value, index) => index === 10 || index === 11 ? money(Number(value), String(row[9])) : index === 12 ? `${Number(value).toFixed(2)}%` : value)), styles: { fontSize: 5.2, cellPadding: 1.1, overflow: "linebreak", valign: "top", lineWidth: 0.1 }, columnStyles: { 0: { cellWidth: 14 }, 1: { cellWidth: 33 }, 2: { cellWidth: 15 }, 3: { cellWidth: 38 }, 4: { cellWidth: 22 }, 5: { cellWidth: 14 }, 6: { cellWidth: 21 }, 7: { cellWidth: 23 }, 8: { cellWidth: 19 }, 9: { cellWidth: 10 }, 10: { cellWidth: 24 }, 11: { cellWidth: 24 }, 12: { cellWidth: 12 } }, headStyles: { fillColor: [8, 47, 99] }, alternateRowStyles: { fillColor: [242, 248, 253] }, didDrawPage: () => { pdf.setFontSize(6); pdf.setTextColor(90, 105, 120); pdf.text("Internal · Procurement Management Information", 8, 205); pdf.text(`Halaman ${pdf.getNumberOfPages()}`, 289, 205, { align: "right" }) } })
  return { blob: pdf.output("blob"), filename }
}
