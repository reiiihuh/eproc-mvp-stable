import * as XLSX from "xlsx"
import { procurementSlaFormulas } from "./procurement-sla-formulas"

import { XlsxWorkspaceAdapter } from "./procurement-data"
import type { ProcurementPic, ProcurementRecord, ProcurementVendor, ProcurementWorkspace, TenderScorecard, WorkspaceSettings } from "./procurement-types"

/**
 * Google Sheets adapter (the live database boundary).
 *
 * Responsibilities:
 * 1. Read the existing workbook without creating APP_* copies.
 * 2. Convert sheet rows through the same XLSX normalizer used by file import.
 * 3. Write procurement, PIC, vendor, and offer changes to their original tabs.
 *
 * UI components must not call the Sheets API directly. Keeping that boundary
 * here makes it possible to replace Sheets with Apps Script/MySQL later.
 */
export type SyncProgress = (message: string) => void

const SHEETS = {
  procurements: "MASTER DATABASE PENGADAAN",
  pics: "MASTER PIC",
  vendors: "VENDOR REKANAN",
  offers: "PENAWARAN VENDOR",
  documents: "DOKUMEN PENGADAAN",
} as const
const LEGACY_SHEETS = Object.values(SHEETS)

export function spreadsheetIdFromUrl(value: string) {
  const trimmed = value.trim()
  const urlMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/)
  if (urlMatch?.[1]) return urlMatch[1]
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) return trimmed
  throw new Error("Link Google Sheets tidak valid. Paste URL lengkap dari browser.")
}

async function sheetsFetch<T>(token: string, url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { "Content-Type": "application/json" } : {}), ...(init?.headers ?? {}) },
  })
  if (!response.ok) {
    const detail = await response.json().catch(() => null) as { error?: { message?: string } } | null
    if (response.status === 403) throw new Error("Akses Google Sheets ditolak. Pastikan Sheets API aktif dan akun lu punya akses edit.")
    if (response.status === 401) throw new Error("Sesi Google sudah habis. Hubungkan ulang akun Google.")
    throw new Error(detail?.error?.message || `Google Sheets error ${response.status}`)
  }
  return response.status === 204 ? undefined as T : response.json() as Promise<T>
}

type SheetMeta = { properties: { title: string; sheetId: number } }
type SpreadsheetMeta = { properties: { title: string }; sheets: SheetMeta[] }
type SheetContext = { sheetId: number; rows: unknown[][]; headerIndex: number; headers: string[] }

const text = (value: unknown) => String(value ?? "").trim()
const quoteSheet = (title: string) => `'${title.replaceAll("'", "''")}'`
const columnName = (index: number) => {
  let value = index + 1
  let result = ""
  while (value) { value -= 1; result = String.fromCharCode(65 + (value % 26)) + result; value = Math.floor(value / 26) }
  return result
}

export class GoogleSheetsWorkspaceAdapter {
  constructor(private token: string, private spreadsheetId: string) {}

  private baseUrl(path = "") { return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(this.spreadsheetId)}${path}` }
  async metadata() { return sheetsFetch<SpreadsheetMeta>(this.token, this.baseUrl("?fields=properties.title,sheets.properties")) }
  private async values(range: string) {
    const result = await sheetsFetch<{ values?: unknown[][] }>(this.token, this.baseUrl(`/values/${encodeURIComponent(range)}?majorDimension=ROWS`))
    return result.values ?? []
  }

  private async context(title: string, requiredHeader: string): Promise<SheetContext> {
    const [meta, rows] = await Promise.all([
      this.metadata(),
      this.values(`${quoteSheet(title)}!A:GV`),
    ])
    const sheet = meta.sheets.find((item) => item.properties.title === title)
    if (!sheet) throw new Error(`Sheet “${title}” tidak ditemukan.`)
    const headerIndex = rows.findIndex((row) => row.some((cell) => text(cell) === requiredHeader))
    if (headerIndex < 0) throw new Error(`Header “${requiredHeader}” tidak ditemukan di ${title}.`)
    return { sheetId: sheet.properties.sheetId, rows, headerIndex, headers: (rows[headerIndex] ?? []).map(text) }
  }

  async loadWorkspace(settings: WorkspaceSettings, scorecards: TenderScorecard[] = [], progress?: SyncProgress): Promise<ProcurementWorkspace> {
    progress?.("Memeriksa struktur spreadsheet utama")
    const meta = await this.metadata()
    const titles = new Set(meta.sheets.map((sheet) => sheet.properties.title))
    if (!titles.has(SHEETS.procurements)) throw new Error(`Sheet “${SHEETS.procurements}” tidak ditemukan.`)
    const workbook = XLSX.utils.book_new()
    progress?.("Membaca master pengadaan, PIC, vendor, dan penawaran")
    const available = LEGACY_SHEETS.filter((title) => titles.has(title))
    const sheetRows = await Promise.all(available.map((title) => this.values(`${quoteSheet(title)}!A:GV`)))
    available.forEach((title, index) => XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(sheetRows[index]), title))
    progress?.("Menormalisasi data untuk dashboard")
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" })
    const file = new File([bytes], `${meta.properties.title}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const loaded = await new XlsxWorkspaceAdapter().import(file, settings, scorecards, progress)
    return { ...loaded, sourceName: meta.properties.title }
  }

  private async writeCells(title: string, rowNumber: number, headers: string[], patches: Record<string, unknown>) {
    const data = Object.entries(patches).flatMap(([header, value]) => {
      const columnIndex = headers.indexOf(header)
      return columnIndex < 0 ? [] : [{ range: `${quoteSheet(title)}!${columnName(columnIndex)}${rowNumber}`, values: [[value ?? ""]] }]
    })
    if (!data.length) return
    await sheetsFetch(this.token, this.baseUrl("/values:batchUpdate"), { method: "POST", body: JSON.stringify({ valueInputOption: "USER_ENTERED", data }) })
  }

  private async copyPreviousRow(sheetId: number, rowNumber: number, columnCount: number) {
    if (rowNumber <= 1) return
    const source = { sheetId, startRowIndex: rowNumber - 2, endRowIndex: rowNumber - 1, startColumnIndex: 0, endColumnIndex: columnCount }
    const destination = { sheetId, startRowIndex: rowNumber - 1, endRowIndex: rowNumber, startColumnIndex: 0, endColumnIndex: columnCount }
    await sheetsFetch(this.token, this.baseUrl(":batchUpdate"), { method: "POST", body: JSON.stringify({ requests: [
      { copyPaste: { source, destination, pasteType: "PASTE_FORMAT", pasteOrientation: "NORMAL" } },
      { copyPaste: { source, destination, pasteType: "PASTE_FORMULA", pasteOrientation: "NORMAL" } },
    ] }) })
  }

  /**
   * Finds the row after the last meaningful record. We intentionally do not
   * reuse holes in the middle: users expect every newly-created item to appear
   * at the bottom of the operational register.
   */
  private appendRow(context: SheetContext, keyHeaders: string[]) {
    const indexes = keyHeaders.map((header) => context.headers.indexOf(header)).filter((index) => index >= 0)
    let lastDataRow = context.headerIndex + 1
    for (let index = context.headerIndex + 1; index < context.rows.length; index++) {
      if (indexes.some((column) => text(context.rows[index]?.[column]))) lastDataRow = index + 1
    }
    return lastDataRow + 1
  }

  /** Adds a missing column at the end without rearranging legacy headers. */
  private async ensureHeader(context: SheetContext, title: string, header: string) {
    if (context.headers.includes(header)) return
    const index = context.headers.reduce((last, value, current) => value ? current : last, -1) + 1
    context.headers[index] = header
    await this.writeCells(title, context.headerIndex + 1, context.headers, { [header]: header })
  }

  /** Creates or updates one procurement, then keeps its tender offers in sync. */
  async upsertProcurement(record: ProcurementRecord) {
    const context = await this.context(SHEETS.procurements, "Nomor Request")
    const memoHeader = context.headers.find((header) => header.replace(/\s+/g, " ").trim().toLowerCase() === "tanggal memo pembelian")
    if (!memoHeader) throw new Error("Kolom Tanggal Memo Pembelian wajib tersedia. Tidak ada kolom baru yang dibuat.")
    await this.ensureHeader(context, SHEETS.procurements, "Currency")
    await this.ensureHeader(context, SHEETS.procurements, "Keterangan Status")
    await this.ensureHeader(context, SHEETS.procurements, "Jenis Budget")
    await this.ensureHeader(context, SHEETS.procurements, "Harga Awal Excl. PPN")
    await this.ensureHeader(context, SHEETS.procurements, "Tanggal Persetujuan Direksi")
    await this.ensureHeader(context, SHEETS.procurements, "Tanggal Send FPC")
    await this.ensureHeader(context, SHEETS.procurements, "Tanggal Approval FPC")
    const isNew = !record.sourceRow || record.sourceRow <= context.headerIndex + 1
    const rowNumber = isNew ? this.appendRow(context, ["Nomor Request", "Tanggal Request", "Item"]) : record.sourceRow!
    if (isNew) await this.copyPreviousRow(context.sheetId, rowNumber, 204)
    const sheetRequestId = record.requestId
    await this.writeCells(SHEETS.procurements, rowNumber, context.headers, {
      Status: record.status, "Keterangan Status": record.statusNotes, "Nomor Request": sheetRequestId, Nama: record.picName, "Group/Div": record.division,
      "Lvl Jabatan": record.position, Lokasi: record.location, "Tanggal Request": record.requestDate, Bentuk: record.requestType,
      "Alamat Email User": record.email, Item: record.itemName, Deskripsi: record.description, Qty: record.quantity,
      Kategori: record.category, "Jenis Permintaan": record.requestKind, PeriodeAwal: record.periodStart || "",
      PeriodeAkhir: record.periodEnd || "", "Metode Pengadaan": record.procurementMethod, Budget: record.budget, "Jenis Budget": record.budgetType || "",
      "Kode Budget": record.budgetCode, "Vendor Terpilih": record.selectedVendor, "Nomor PO": record.poNumber,
      "Tanggal PO": record.poDate || "", [memoHeader]: record.memoDate || "", "Tanggal Persetujuan Direksi": record.directorApprovalDate || "", "Tanggal Send FPC": record.fpcSentDate || "", "Tanggal Approval FPC": record.fpcApprovalDate || "", "Harga Awal Excl. PPN": Number(record.initialPriceExcl || 0), "Amount PO Excl. PPN": Number(record.poAmountExcl || 0),
      "Amount PO Incld. PPN": Number(record.poAmountIncl || 0), "Amount Efficiency incld PPN": Number(record.efficiency || 0), Currency: record.currency,
      ...procurementSlaFormulas(context.headers, rowNumber),
    })
    await this.replaceOffers(sheetRequestId, record.procurementMethod === "Tender" ? record.offers : [])
    return { ...record, sourceRow: rowNumber }
  }

  /**
   * Replaces offers for one request as a unit. Existing rows are reused first;
   * additional vendors append at the bottom of PENAWARAN VENDOR.
   */
  private async replaceOffers(requestId: string, offers: ProcurementRecord["offers"]) {
    const context = await this.context(SHEETS.offers, "Request ID")
    const requestColumn = context.headers.indexOf("Request ID")
    const existingRows = context.rows.map((row, index) => ({ row, rowNumber: index + 1 })).filter(({ row, rowNumber }) => rowNumber > context.headerIndex + 1 && text(row[requestColumn]) === requestId)
    if (existingRows.length) await sheetsFetch(this.token, this.baseUrl("/values:batchClear"), { method: "POST", body: JSON.stringify({ ranges: existingRows.map(({ rowNumber }) => `${quoteSheet(SHEETS.offers)}!A${rowNumber}:L${rowNumber}`) }) })
    const reusable = existingRows.map(({ rowNumber }) => rowNumber)
    let appendRow = this.appendRow(context, ["Request ID", "Vendor"])
    for (let index = 0; index < offers.length; index++) {
      const rowNumber = reusable[index] ?? appendRow++
      const offer = offers[index]
      await this.writeCells(SHEETS.offers, rowNumber, context.headers, {
        "Request ID": requestId, "Urutan (Auto)": index + 1, Vendor: offer.vendor, "Penawaran Awal": offer.initialOffer,
        "Penawaran Revisi/BAFO": offer.bafo, "Harga Final/Nego": offer.finalOffer, "PPN %": offer.taxRate,
        "Final Incl. PPN": offer.finalOffer * (1 + offer.taxRate), "Link Penawaran/BAFO": offer.quotationLink || "",
        "Lolos Teknis": offer.technicalPass ? "Ya" : "Tidak", Pemenang: offer.winner ? "Ya" : "Tidak",
      })
    }
  }

  async deleteProcurement(record: ProcurementRecord) {
    await this.deleteProcurements([record])
  }

  async deleteProcurements(records: ProcurementRecord[]) {
    await Promise.all(records.map((record) => this.replaceOffers(record.requestId, [])))
    await this.deleteRows(SHEETS.procurements, "Nomor Request", records.map((record) => record.sourceRow))
  }

  async upsertPic(pic: ProcurementPic) {
    const context = await this.context(SHEETS.pics, "Nama PIC")
    const isNew = !pic.sourceRow
    const rowNumber = isNew ? this.appendRow(context, ["PIC ID", "Nama PIC"]) : pic.sourceRow!
    if (isNew) await this.copyPreviousRow(context.sheetId, rowNumber, 7)
    const id = pic.id || `PIC-${String(rowNumber - context.headerIndex - 1).padStart(3, "0")}`
    await this.writeCells(SHEETS.pics, rowNumber, context.headers, { "PIC ID": id, "Nama PIC": pic.name, "Group/Divisi": pic.division, Jabatan: pic.position, Lokasi: pic.location, Email: pic.email, Status: pic.active ? "Aktif" : "Tidak Aktif" })
    return { ...pic, id, sourceRow: rowNumber }
  }

  async deletePic(pic: ProcurementPic) { await this.deleteRow(SHEETS.pics, "Nama PIC", pic.sourceRow) }
  async deletePics(pics: ProcurementPic[]) { await this.deleteRows(SHEETS.pics, "Nama PIC", pics.map((pic) => pic.sourceRow)) }

  async upsertVendor(vendor: ProcurementVendor) {
    const context = await this.context(SHEETS.vendors, "Nama Pihak Penyedia Jasa")
    // Kolom baru ditambahkan di ujung agar susunan legacy VENDOR REKANAN tetap aman.
    await this.ensureHeader(context, SHEETS.vendors, "Nama Bank")
    await this.ensureHeader(context, SHEETS.vendors, "Nomor Rekening")
    const isNew = !vendor.sourceRow
    const rowNumber = isNew ? this.appendRow(context, ["Nama Pihak Penyedia Jasa"]) : vendor.sourceRow!
    if (isNew) await this.copyPreviousRow(context.sheetId, rowNumber, 64)
    await this.writeCells(SHEETS.vendors, rowNumber, context.headers, {
      No: rowNumber - context.headerIndex - 1, "Status Prioritas": vendor.priority, "Status Kelengkapan Dokumen": vendor.documentStatus,
      "Kesediaan Buka Rekening": vendor.bankAccountCommitment, "Nama Bank": vendor.bankName, "Nomor Rekening": vendor.bankAccountNumber, "Nama Pihak Penyedia Jasa": vendor.name,
      "Alamat Penyedia Jasa TI": vendor.address, "Jasa Yang diberikan": vendor.services, "Nama PIC 1": vendor.picName,
      "Contact Person 1": vendor.phone, "Email 1": vendor.email, "Jabatan/Divisi Contact Person 1": vendor.position,
      "Kritikal/Non Kritikal": vendor.criticality, Kategori: vendor.category, "Barang/Jasa": vendor.goodsOrServices,
      PKS: vendor.agreementStatus, Keterangan: vendor.notes,
    })
    return { ...vendor, id: `vendor-row-${rowNumber}`, sourceRow: rowNumber }
  }

  async deleteVendor(vendor: ProcurementVendor) { await this.deleteRow(SHEETS.vendors, "Nama Pihak Penyedia Jasa", vendor.sourceRow) }
  async deleteVendors(vendors: ProcurementVendor[]) { await this.deleteRows(SHEETS.vendors, "Nama Pihak Penyedia Jasa", vendors.map((vendor) => vendor.sourceRow)) }

  private async deleteRow(title: string, header: string, sourceRow?: number) {
    await this.deleteRows(title, header, [sourceRow])
  }

  /** Deletes bottom-up so earlier source-row numbers remain valid. */
  private async deleteRows(title: string, header: string, sourceRows: Array<number | undefined>) {
    const rows = [...new Set(sourceRows.filter((row): row is number => Boolean(row)))].sort((a, b) => b - a)
    if (!rows.length) throw new Error("Baris sheet tidak ditemukan. Refresh lalu coba lagi.")
    const context = await this.context(title, header)
    await sheetsFetch(this.token, this.baseUrl(":batchUpdate"), { method: "POST", body: JSON.stringify({ requests: rows.map((sourceRow) => ({ deleteDimension: { range: { sheetId: context.sheetId, dimension: "ROWS", startIndex: sourceRow - 1, endIndex: sourceRow } } })) }) })
  }
}
