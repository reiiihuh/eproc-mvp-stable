import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import test from "node:test"
import { formatIndonesianDate, formatIndonesianDateTime } from "../lib/indonesian-date.ts"

const source = await readFile(new URL("../integration/portal-apps-script/ProcurementReview.gs", import.meta.url), "utf8")
function backend() {
  const context = vm.createContext({ Date })
  vm.runInContext(source, context)
  context.getSpreadsheet_ = () => ({ getSpreadsheetTimeZone: () => "Asia/Jakarta", getSpreadsheetLocale: () => "id_ID" })
  context.Utilities = { parseDate(value, zone, pattern) {
    assert.equal(zone, "Asia/Jakarta")
    assert.equal(pattern, "yyyy-MM-dd")
    return new Date(`${value}T00:00:00+07:00`)
  } }
  return context
}

test("tanggal Indonesia konsisten dan timestamp mengikuti Jakarta", () => {
  assert.equal(formatIndonesianDate("2026-09-17"), "17-Sep-2026")
  for (const [month, name] of [[5, "Mei"], [8, "Agu"], [10, "Okt"], [12, "Des"]]) {
    assert.equal(formatIndonesianDate(`2026-${String(month).padStart(2, "0")}-01`), `01-${name}-2026`)
  }
  assert.equal(formatIndonesianDate("2026-09-16T17:00:00Z"), "17-Sep-2026")
  assert.match(formatIndonesianDateTime("2026-09-16T17:00:00Z"), /^17-Sep-2026 00[.:]00 WIB$/)
  assert.equal(formatIndonesianDate(""), "")
})

test("backend membaca ISO dan tanggal Indonesia tanpa menukar hari dan bulan", () => {
  const context = backend()
  for (const value of ["2026-09-17", "17-Sep-2026", "17/09/2026"]) {
    assert.equal(context.procurementParseCalendarDate_(value).toISOString(), "2026-09-16T17:00:00.000Z")
  }
  assert.equal(context.procurementParseCalendarDate_("01-Mei-2026").toISOString(), "2026-04-30T17:00:00.000Z")
  assert.throws(() => context.procurementParseCalendarDate_("31/02/2026"), /INVALID_DATE/)
  assert.equal(context.procurementParseCalendarDate_(""), "")
})

test("penyimpanan menulis Date asli dan format tanggal tanpa memformat angka budget", () => {
  const context = backend(), writes = [], formats = []
  const sheet = { getRange(row, column) { return {
    setValues(values) { writes.push({ row, column, values }); return this },
    setNumberFormat(format) { formats.push({ column, format }); return this },
  } } }
  context.procurementWritePatches_(sheet, 3, ["Tanggal Memo Pembelian", "Budget", "PeriodeAwal"], { "Tanggal Memo Pembelian": "2026-09-17", Budget: 125000, PeriodeAwal: "2026-10-01" })
  assert.equal(writes[0].values[0][0].toISOString(), "2026-09-16T17:00:00.000Z")
  assert.equal(writes[0].values[0][1], 125000)
  assert.deepEqual(formats, [{ column: 1, format: "dd-mmm-yyyy" }, { column: 3, format: "dd-mmm-yyyy" }])
})

test("normalisasi semua dataset mempertahankan formula dan memvalidasi sebelum menulis", () => {
  const context = backend(), writes = []
  let invalid = false
  const sheet = { getLastRow: () => 4, getRange() { return {
    getValues: () => [["17-Sep-2026"], [invalid ? "31/02/2026" : ""], [45600]],
    getFormulas: () => [[""], [""], ["=TODAY()"]],
    setValues(values) { writes.push(values); return this }, setNumberFormat() { return this },
  } } }
  context.getSpreadsheet_ = () => ({ getSheetByName: () => sheet, getSpreadsheetTimeZone: () => "Asia/Jakarta", getSpreadsheetLocale: () => "id_ID" })
  context.portalWithLock_ = fn => fn()
  context.procurementDatasetRows_ = () => [{ masterSheet: "2026" }, { masterSheet: "2027" }]
  context.procurementMasterContext_ = () => ({ headerRow: 1, headers: ["Tanggal Request"] })
  context.SpreadsheetApp = { flush() {} }
  context.Logger = { log() {} }
  context.normalizeProcurementDates()
  assert.equal(writes.length, 2)
  assert.equal(writes[0][0][0].toISOString(), "2026-09-16T17:00:00.000Z")
  assert.equal(writes[0][1][0], "")
  assert.equal(writes[0][2][0], "=TODAY()")
  invalid = true
  assert.throws(() => context.normalizeProcurementDates(), /INVALID_DATE/)
  assert.equal(writes.length, 2)
})
