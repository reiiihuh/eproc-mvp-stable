import * as XLSX from "xlsx"
import type {
  ProcurementRecord,
  ProcurementPic,
  ProcurementVendor,
  ProcurementStatus,
  ProcurementWorkspace,
  TenderOffer,
  TenderScorecard,
  WorkspaceSettings,
} from "./procurement-types"

/**
 * Canonical workbook parser/exporter.
 *
 * Google Sheets and uploaded XLSX files both pass through this module, so all
 * header aliases, currency parsing, dates, IDs, and legacy fallbacks behave in
 * exactly the same way. Add new Excel column aliases here—not in React views.
 */
export interface WorkspaceAdapter {
  import(file: File, settings: WorkspaceSettings, scorecards?: TenderScorecard[], progress?: (message: string) => void): Promise<ProcurementWorkspace>
  export(workspace: ProcurementWorkspace): Blob
}

export interface DatabaseAdapter {
  loadWorkspace(): Promise<ProcurementWorkspace>
  saveWorkspace(workspace: ProcurementWorkspace): Promise<void>
}

const DEFAULT_SETTINGS: WorkspaceSettings = {
  requestIdPattern: "PROC-{YEAR}-{SEQ4}",
  driveClientId: "",
  driveRootFolder: "Pengadaan IT",
  sheetsSpreadsheetUrl: "",
  defaultPageSize: 10,
  autoRefreshSeconds: 30,
}

const asText = (value: unknown) => String(value ?? "").trim()
const hasValue = (value: unknown) => value !== undefined && value !== null && asText(value) !== ""
const firstValue = (row: Record<string, unknown>, headers: string[]) => headers.map((header) => row[header]).find(hasValue)
const asNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value
  const cleaned = String(value ?? "").replace(/[^0-9,.-]/g, "")
  if (!cleaned) return 0
  const lastComma = cleaned.lastIndexOf(",")
  const lastDot = cleaned.lastIndexOf(".")
  let normalized = cleaned
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? cleaned.replaceAll(".", "").replace(",", ".")
      : cleaned.replaceAll(",", "")
  } else if (lastComma >= 0) {
    normalized = /^-?\d{1,3}(,\d{3})+$/.test(cleaned) ? cleaned.replaceAll(",", "") : cleaned.replace(",", ".")
  } else if ((cleaned.match(/\./g) ?? []).length > 1) {
    normalized = cleaned.replaceAll(".", "")
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : 0
}
const excelDate = (value: unknown) => {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (parsed) return `${parsed.y}-${String(parsed.m).padStart(2, "0")}-${String(parsed.d).padStart(2, "0")}`
  }
  const text = asText(value)
  if (!text) return ""
  const date = new Date(text)
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10)
}
const normalizeStatus = (value: unknown): ProcurementStatus => {
  const status = asText(value).toLowerCase()
  if (["selesai", "complete", "completed", "done"].includes(status)) return "Complete"
  if (status === "ongoing" || status === "in progress") return "Ongoing"
  if (status === "po") return "PO"
  if (status === "dropped" || status === "cancelled") return "Dropped"
  return "Upcoming"
}
const fnv = (input: string) => {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36)
}
const rowObject = (headers: string[], row: unknown[]) =>
  Object.fromEntries(headers.map((header, index) => [header, row[index]]))

function parsePics(workbook: XLSX.WorkBook, records: ProcurementRecord[]): ProcurementPic[] {
  const sheet = workbook.Sheets["MASTER PIC"]
  const parsed: ProcurementPic[] = []

  if (sheet) {
    const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" })
    const headerIndex = grid.findIndex((row) => row.some((cell) => asText(cell) === "Nama PIC"))
    if (headerIndex >= 0) {
      const headers = grid[headerIndex].map(asText)
      grid.slice(headerIndex + 1).forEach((row, index) => {
        const item = rowObject(headers, row)
        const name = asText(item["Nama PIC"])
        if (!name) return
        parsed.push({
          id: asText(item["PIC ID"]) || `pic-${index + 1}`,
          sourceRow: headerIndex + 2 + index,
          name,
          division: asText(item["Group/Divisi"]),
          position: asText(item["Jabatan"]),
          location: asText(item["Lokasi"]),
          email: asText(item["Email"]),
          active: !["tidak aktif", "inactive", "nonaktif"].includes(asText(item["Status"]).toLowerCase()),
        })
      })
    }
  }

  if (parsed.length) return parsed

  const fallback = new Map<string, ProcurementPic>()
  records.forEach((record) => {
    const key = record.picName.toLowerCase()
    if (!key || fallback.has(key)) return
    fallback.set(key, {
      id: `derived-${fnv(key)}`,
      name: record.picName,
      division: record.division,
      position: record.position,
      location: record.location,
      email: record.email,
      active: true,
    })
  })
  return [...fallback.values()].sort((a, b) => a.name.localeCompare(b.name, "id"))
}

function parseVendors(workbook: XLSX.WorkBook): ProcurementVendor[] {
  const sheet = workbook.Sheets["VENDOR REKANAN"]
  if (!sheet) return []
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" })
  const headerIndex = grid.findIndex((row) => row.some((cell) => asText(cell) === "Nama Pihak Penyedia Jasa"))
  if (headerIndex < 0) return []
  const headers = grid[headerIndex].map(asText)
  return grid.slice(headerIndex + 1).flatMap((row, index) => {
    const item = rowObject(headers, row)
    const name = asText(item["Nama Pihak Penyedia Jasa"])
    if (!name || name === "0") return []
    const sourceRow = headerIndex + 2 + index
    return [{
      id: `vendor-row-${sourceRow}`, sourceRow, name,
      priority: asText(item["Status Prioritas"]), documentStatus: asText(item["Status Kelengkapan Dokumen"]),
      bankAccountCommitment: asText(item["Kesediaan Buka Rekening"]), bankName: asText(item["Nama Bank"] ?? item["Bank"]), bankAccountNumber: asText(item["Nomor Rekening"] ?? item["No Rekening"]), address: asText(item["Alamat Penyedia Jasa TI"]),
      services: asText(item["Jasa Yang diberikan"]), picName: asText(item["Nama PIC 1"]), phone: asText(item["Contact Person 1"]),
      email: asText(item["Email 1"]), position: asText(item["Jabatan/Divisi Contact Person 1"]),
      criticality: asText(item["Kritikal/Non Kritikal"]), category: asText(item["Kategori"]),
      goodsOrServices: asText(item["Barang/Jasa"]), agreementStatus: asText(item["PKS"]), notes: asText(item["Keterangan"]),
    }]
  })
}

/** Formats a user-facing request number; recordUid remains the true unique key. */
export function formatRequestId(pattern: string, year: number, sequence: number) {
  return pattern
    .replaceAll("{YEAR}", String(year))
    .replaceAll("{SEQ}", String(sequence))
    .replaceAll("{SEQ4}", String(sequence).padStart(4, "0"))
}

/** Dipertahankan untuk migrasi eksplisit; jangan dipakai saat memuat master aktif. */
export function normalizeRequestIds(records: ProcurementRecord[], pattern: string) {
  const sequenceByYear = new Map<number, number>()
  return [...records]
    .sort((a, b) => {
      const dateCompare = (a.requestDate || "9999").localeCompare(b.requestDate || "9999")
      return dateCompare || (a.sourceRow ?? 0) - (b.sourceRow ?? 0)
    })
    .map((record) => {
      const year = Number(record.requestDate.slice(0, 4)) || new Date().getFullYear()
      const sequence = (sequenceByYear.get(year) ?? 0) + 1
      sequenceByYear.set(year, sequence)
      return {
        ...record,
        originalRequestId: record.originalRequestId || record.requestId || undefined,
        requestId: formatRequestId(pattern, year, sequence),
      }
    })
}

function parseMaster(sheet: XLSX.WorkSheet) {
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" })
  const headerIndex = grid.findIndex((row) => row.some((cell) => asText(cell) === "Nomor Request"))
  if (headerIndex < 0) throw new Error("Header 'Nomor Request' tidak ditemukan di sheet master.")
  const headers = grid[headerIndex].map(asText)
  const records: ProcurementRecord[] = []
  grid.slice(headerIndex + 1).forEach((row, offset) => {
    const sourceRow = headerIndex + 2 + offset
    const item = rowObject(headers, row)
    const itemName = asText(item["Item"])
    const requestDate = excelDate(item["Tanggal Request"])
    const requestId = asText(item["Nomor Request"])
    const originalRequestId = asText(item["Request ID Asli"]) || requestId
    if (!itemName && !requestDate && !requestId) return
    const offers: TenderOffer[] = []
    for (let index = 1; index <= 4; index++) {
      const vendor = asText(item[`Vendor ${index}`])
      if (!vendor) continue
      offers.push({
        id: `offer-${sourceRow}-${index}`,
        vendor,
        initialOffer: asNumber(item[`Penawaran Vendor ${index} `] ?? item[`Penawaran Vendor ${index}`]),
        bafo: asNumber(item[`Nego Harga Vendor ${index} `] ?? item[`Nego Harga Vendor ${index}`]),
        finalOffer: asNumber(item[`Nego Harga Vendor ${index} `] ?? item[`Nego Harga Vendor ${index}`]),
        taxRate: 0.11,
        technicalPass: true,
        winner: vendor === asText(item["Vendor Terpilih"]),
      })
    }
    const firstOffer = offers[0]
    const rawPoAmountExcl = item["Amount PO Excl. PPN"]
    const poAmountExcl = hasValue(rawPoAmountExcl) ? asNumber(rawPoAmountExcl) : firstOffer?.finalOffer ?? 0
    const rawPoAmountIncl = item["Amount PO Incld. PPN"]
    const parsedPoAmountIncl = asNumber(rawPoAmountIncl)
    const poAmountIncl = parsedPoAmountIncl || (poAmountExcl ? poAmountExcl * 1.11 : 0)
    const rawEfficiency = item["Amount Efficiency incld PPN"]
    const fallbackEfficiency = item["Amount Efficiency"]
    const calculatedEfficiency = firstOffer ? Math.max(0, firstOffer.initialOffer - firstOffer.finalOffer) : 0
    const parsedEfficiencyIncl = asNumber(rawEfficiency)
    const parsedEfficiencyExcl = asNumber(fallbackEfficiency)
    const currencyHint = [item["Currency"], rawPoAmountIncl, rawPoAmountExcl, rawEfficiency, fallbackEfficiency].map(asText).join(" ").toUpperCase()
    const currency: ProcurementRecord["currency"] = currencyHint.includes("SGD") || currencyHint.includes("S$") ? "SGD" : currencyHint.includes("USD") || currencyHint.includes("US$") ? "USD" : "IDR"
    const seed = [originalRequestId, itemName, requestDate, sourceRow].join("|")
    const documentPairs = [
      ["PKS", "PKS", "Link PKS"], ["Memo Izin/Internal", "Memo Izin Prinsip/ Memo Internal", "Link IZIn"],
      ["FPB", "FPB", "Link FPB"], ["RFP", "RFP", "Link RFP"], ["Form Peripheral", "Form Peripheral", "Link Perip"],
      ["SPB", "SPB", "Link SPB"], ["IT Support", "Konfirmasi IT Support", "Link IT"],
      ["IT Asset", "Konfirmasi IT Asset BSIM", "Link Konfirmasi"], ["Evaluasi Vendor", "Formulir Evaluasi Vendor", "Form Evaluasi Vendor Link"],
      ["NDA", "NDA", "Link NDA"], ["PO", "Nomor PO", "Link PO"], ["BAST", "Nomor BAST", "Link BAST"],
    ] as const
    const documents = documentPairs.flatMap(([type, nameHeader, linkHeader], documentIndex) => {
      const name = asText(item[nameHeader])
      const rawLink = asText(item[linkHeader])
      const link = /^https?:\/\//i.test(rawLink) ? rawLink : ""
      const placeholder = ["", "0", "-", "n/a", "na", "false", "tidak", "tidak ada", "tidak perlu"].includes(name.toLowerCase())
      if (placeholder && !link) return []
      return [{ id: `master-document-${sourceRow}-${documentIndex}`, name: name || type, type, webViewLink: link || undefined, state: link ? "uploaded" as const : "pending" as const }]
    })
    records.push({
      recordUid: `legacy-${fnv(seed)}`,
      requestId,
      originalRequestId,
      sourceRow,
      requestDate,
      status: normalizeStatus(item["Status"]),
      statusNotes: asText(item["Keterangan Status"] ?? item["Status Keterangan"]),
      picName: asText(item["Nama"]),
      division: asText(item["Group/Div"]),
      position: asText(item["Lvl Jabatan"]),
      email: asText(item["Alamat Email User"]),
      location: asText(item["Lokasi"]),
      requestType: asText(item["Bentuk"]),
      itemName,
      description: asText(item["Deskripsi"]),
      quantity: asNumber(item["Qty"]) || 1,
      category: asText(item["Kategori"]),
      requestKind: asText(item["Jenis Permintaan"]),
      periodStart: excelDate(item["PeriodeAwal"]),
      periodEnd: excelDate(item["PeriodeAkhir"]),
      procurementMethod: asText(item["Metode Pengadaan"]),
      budget: asNumber(item["Budget"]),
      budgetType: (asText(item["Jenis Budget"] ?? item["Budget Type"]).toUpperCase() || undefined) as ProcurementRecord["budgetType"],
      budgetCode: asText(item["Kode Budget"]),
      selectedVendor: asText(item["Vendor Terpilih"]),
      poNumber: asText(item["Nomor PO"]),
      poDate: excelDate(item["Tanggal PO"]),
      memoDate: excelDate(firstValue(item, ["Tanggal Memo", "Tanggal Memo Izin", "Tanggal Memo Direksi", "Memo Date"])),
      directorApprovalDate: excelDate(firstValue(item, ["Tanggal Persetujuan Direksi", "Tanggal Approval Direksi", "Approval Memo Direksi", "Direksi Approval Date"])),
      fpcSentDate: excelDate(firstValue(item, ["Tanggal Send FPC", "Tanggal Kirim FPC", "Send FPC", "FPC Sent Date"])),
      fpcApprovalDate: excelDate(firstValue(item, ["Tanggal Approval FPC", "Tanggal Persetujuan FPC", "Approval FPC", "FPC Approval Date"])),
      poAmountExcl,
      initialPriceExcl: asNumber(item["Harga Awal Excl. PPN"] ?? item["Penawaran Awal"]),
      poAmountIncl,
      efficiency: parsedEfficiencyIncl || (parsedEfficiencyExcl ? parsedEfficiencyExcl * 1.11 : calculatedEfficiency * 1.11),
      currency,
      offers,
      documents,
    })
  })
  return records
}

function mergeDynamicOffers(workbook: XLSX.WorkBook, records: ProcurementRecord[]) {
  const sheet = workbook.Sheets["PENAWARAN VENDOR"]
  if (!sheet) return records
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" })
  const headerIndex = grid.findIndex((row) => row.some((cell) => asText(cell) === "Request ID"))
  if (headerIndex < 0) return records
  const headers = grid[headerIndex].map(asText)
  const byOriginalId = new Map<string, ProcurementRecord[]>()
  records.forEach((record) => {
    const key = record.originalRequestId || record.requestId
    byOriginalId.set(key, [...(byOriginalId.get(key) ?? []), record])
  })
  grid.slice(headerIndex + 1).forEach((row, index) => {
    const item = rowObject(headers, row)
    const requestId = asText(item["Request ID"])
    const vendor = asText(item["Vendor"])
    const target = byOriginalId.get(requestId)?.[0]
    if (!target || !vendor) return
    const rawTaxRate = asNumber(item["PPN %"])
    target.offers.push({
      id: `dynamic-${target.recordUid}-${index}`,
      vendor,
      initialOffer: asNumber(item["Penawaran Awal"]),
      bafo: asNumber(item["BAFO / Penawaran Terbaik"] ?? item["Penawaran Revisi/BAFO"]),
      finalOffer: asNumber(item["Harga Final / Nego"] ?? item["Harga Final/Nego"]),
      taxRate: rawTaxRate > 1 ? rawTaxRate / 100 : rawTaxRate || 0.11,
      technicalPass: asText(item["Lulus Teknis"] ?? item["Lolos Teknis"]).toLowerCase() !== "tidak",
      winner: asText(item["Pemenang"]).toLowerCase() === "ya",
      quotationLink: asText(item["Link Penawaran"] ?? item["Link Penawaran/BAFO"]),
    })
  })
  records.forEach((record) => {
    const deduped = new Map<string, TenderOffer>()
    record.offers.forEach((offer) => deduped.set(offer.vendor.toLowerCase(), offer))
    record.offers = [...deduped.values()]
  })
  return records
}

function mergeProcurementDocuments(workbook: XLSX.WorkBook, records: ProcurementRecord[]) {
  const sheet = workbook.Sheets["DOKUMEN PENGADAAN"]
  if (!sheet) return records
  const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: true, defval: "" })
  const headerIndex = grid.findIndex((row) => row.some((cell) => asText(cell) === "Request ID"))
  if (headerIndex < 0) return records
  const headers = grid[headerIndex].map(asText)
  const recordsByOriginalId = new Map<string, ProcurementRecord[]>()
  records.forEach((record) => {
    const key = record.originalRequestId || record.requestId
    recordsByOriginalId.set(key, [...(recordsByOriginalId.get(key) ?? []), record])
  })
  const documentPairs = [
    ["PKS", "Link PKS"], ["Memo Izin/Internal", "Link Memo Izin"], ["FPB", "Link FPB"],
    ["RFP", "Link RFP"], ["Form Peripheral", "Link Form Peripheral"], ["SPB", "Link SPB"],
    ["IT Support", "Link IT Support"], ["IT Asset", "Link IT Asset"], ["Evaluasi Vendor", "Link Evaluasi Vendor"],
  ] as const
  grid.slice(headerIndex + 1).forEach((row, rowIndex) => {
    const item = rowObject(headers, row)
    const requestId = asText(item["Request ID"])
    const target = recordsByOriginalId.get(requestId)?.[0]
    if (!target) return
    documentPairs.forEach(([type, linkHeader], pairIndex) => {
      const link = asText(item[linkHeader])
      const status = asText(item[`Status ${type}`])
      if (!link && !status) return
      target.documents.push({
        id: `document-${target.recordUid}-${rowIndex}-${pairIndex}`,
        name: status || type,
        type,
        webViewLink: link || undefined,
        state: link ? "uploaded" : "pending",
      })
    })
  })
  return records
}

/** File-based adapter retained for offline import/export and migration backup. */
export class XlsxWorkspaceAdapter implements WorkspaceAdapter {
  async import(file: File, settings: WorkspaceSettings, scorecards: TenderScorecard[] = [], progress?: (message: string) => void) {
    progress?.("Membaca isi workbook")
    const workbook = XLSX.read(await file.arrayBuffer(), { cellDates: true })
    const master = workbook.Sheets["MASTER DATABASE PENGADAAN"]
    if (!master) throw new Error("Sheet MASTER DATABASE PENGADAAN tidak ditemukan.")
    progress?.("Memetakan master, PIC, vendor, dan dokumen")
    const records = mergeProcurementDocuments(workbook, mergeDynamicOffers(workbook, parseMaster(master)))
    progress?.("Menyiapkan data pengadaan")
    return {
      version: 1 as const,
      importedAt: new Date().toISOString(),
      sourceName: file.name,
      settings: { ...DEFAULT_SETTINGS, ...settings },
      pics: parsePics(workbook, records),
      vendors: parseVendors(workbook),
      scorecards,
      // Nomor request adalah identitas lintas portal dan master; jangan diubah saat dibaca.
      records,
    }
  }

  export(workspace: ProcurementWorkspace) {
    const workbook = XLSX.utils.book_new()
    const masterRows = workspace.records.map((record, index) => ({
      No: index + 1,
      "Record UID": record.recordUid,
      Status: record.status,
      "Keterangan Status": record.statusNotes,
      "Request ID": record.requestId,
      "Request ID Asli": record.originalRequestId ?? "",
      "Tanggal Request": record.requestDate,
      PIC: record.picName,
      Divisi: record.division,
      Jabatan: record.position,
      Email: record.email,
      "Nama Pengadaan": record.itemName,
      Deskripsi: record.description,
      Qty: record.quantity,
      Kategori: record.category,
      Metode: record.procurementMethod,
      Budget: record.budget,
      "Jenis Budget": record.budgetType ?? "",
      "Vendor Terpilih": record.selectedVendor,
      "Nomor PO": record.poNumber,
      "Tanggal PO": record.poDate ?? "",
      "Tanggal Memo": record.memoDate ?? "",
      "Tanggal Persetujuan Direksi": record.directorApprovalDate ?? "",
      "Tanggal Send FPC": record.fpcSentDate ?? "",
      "Tanggal Approval FPC": record.fpcApprovalDate ?? "",
      "PO Excl. PPN": record.poAmountExcl,
      "Harga Awal Excl. PPN": record.initialPriceExcl ?? 0,
      "PO Incl. PPN": record.poAmountIncl,
      Efisiensi: record.efficiency,
      Currency: record.currency,
    }))
    const offerRows = workspace.records.flatMap((record) =>
      record.offers.map((offer, index) => ({
        "Record UID": record.recordUid,
        "Request ID": record.requestId,
        Urutan: index + 1,
        Vendor: offer.vendor,
        "Penawaran Awal": offer.initialOffer,
        BAFO: offer.bafo,
        "Harga Final": offer.finalOffer,
        "PPN %": offer.taxRate,
        "Lulus Teknis": offer.technicalPass ? "Ya" : "Tidak",
        Pemenang: offer.winner ? "Ya" : "Tidak",
      })),
    )
    const documentRows = workspace.records.flatMap((record) =>
      record.documents.map((document) => ({
        "Record UID": record.recordUid,
        "Request ID": record.requestId,
        "Jenis Dokumen": document.type,
        "Nama File": document.name,
        "Drive File ID": document.driveFileId ?? "",
        Link: document.webViewLink ?? "",
      })),
    )
    const picRows = workspace.pics.map((pic) => ({
      "PIC ID": pic.id,
      "Nama PIC": pic.name,
      "Group/Divisi": pic.division,
      Jabatan: pic.position,
      Lokasi: pic.location,
      Email: pic.email,
      Status: pic.active ? "Aktif" : "Tidak Aktif",
    }))
    const vendorRows = workspace.vendors.map((vendor, index) => ({
      No: index + 1, "Status Prioritas": vendor.priority, "Status Kelengkapan Dokumen": vendor.documentStatus,
      "Kesediaan Buka Rekening": vendor.bankAccountCommitment, "Nama Bank": vendor.bankName, "Nomor Rekening": vendor.bankAccountNumber, "Nama Pihak Penyedia Jasa": vendor.name,
      "Alamat Penyedia Jasa TI": vendor.address, "Jasa Yang diberikan": vendor.services, "Nama PIC 1": vendor.picName,
      "Contact Person 1": vendor.phone, "Email 1": vendor.email, "Jabatan/Divisi Contact Person 1": vendor.position,
      "Kritikal/Non Kritikal": vendor.criticality, Kategori: vendor.category, "Barang/Jasa": vendor.goodsOrServices,
      PKS: vendor.agreementStatus, Keterangan: vendor.notes,
    }))
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(masterRows), "MASTER PENGADAAN")
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(offerRows), "PENAWARAN VENDOR")
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(documentRows), "DOKUMEN")
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(picRows), "MASTER PIC")
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(vendorRows), "VENDOR REKANAN")
    return new Blob([XLSX.write(workbook, { type: "array", bookType: "xlsx" })], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })
  }
}

export const defaultSettings = DEFAULT_SETTINGS
