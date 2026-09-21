import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { createRequire } from "node:module"
import vm from "node:vm"
import test from "node:test"
import ts from "typescript"
import * as XLSX from "xlsx"

const source = await readFile(new URL("../lib/procurement-data.ts", import.meta.url), "utf8")
const parser = vm.createContext({ exports: {}, require: createRequire(import.meta.url), Date })
vm.runInContext(ts.transpileModule(source + "\nexport { parseMaster };", { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, parser)
const backendSource = await readFile(new URL("../integration/portal-apps-script/ProcurementReview.gs", import.meta.url), "utf8")

test("memo pembelian menjadi sumber tanggal meskipun kolom memo lain berbeda atau terisi", () => {
  for (const memo of ["2026-09-24", ""]) {
    const sheet = XLSX.utils.aoa_to_sheet([
      ["Nomor Request", "Item", "Tanggal Request", "Tanggal Memo", "Tanggal Memo\nPembelian"],
      ["REQ-1", "Laptop", "2026-09-01", "2026-09-25", memo],
    ])
    assert.equal(parser.exports.parseMaster(sheet)[0].memoDate, memo)
  }
})

test("template dengan hanya Tanggal Memo tetap terbaca", () => {
  const sheet = XLSX.utils.aoa_to_sheet([["Nomor Request", "Item", "Tanggal Memo"], ["REQ-1", "Laptop", "2026-09-25"]])
  assert.equal(parser.exports.parseMaster(sheet)[0].memoDate, "2026-09-25")
})

test("edit memo menulis kolom pembelian yang sama dengan pembacaan dan memasang ulang SLA", () => {
  const backend = vm.createContext({})
  vm.runInContext(backendSource, backend)
  let patches, slaRow
  const sheet = { getLastRow: () => 3, getRange: () => ({ setNumberFormat() {} }) }
  backend.portalWithLock_ = fn => fn()
  backend.procurementActor_ = () => ({})
  backend.procurementResolveDataset_ = () => ({ masterSheet: "Master", legacy: true })
  backend.getSpreadsheet_ = () => ({ getSheetByName: () => sheet })
  backend.procurementMasterContext_ = () => ({ headerRow: 1, headers: ["Nomor Request", "Tanggal Memo", "Tanggal Memo\nPembelian"] })
  backend.portalRowsFromSheet_ = () => [{ "Nomor Request": "REQ-1", __rowNumber: 3 }]
  backend.procurementWritePatches_ = (_sheet, _row, _headers, values) => { patches = values }
  backend.procurementWriteSlaFormulas_ = (_sheet, row) => { slaRow = row }
  backend.procurementReplaceOffers_ = () => {}
  backend.SpreadsheetApp = { flush() {} }
  backend.procurementUpsertRecord_({ mode: "edit", record: { requestId: "REQ-1", sourceRow: 3, memoDate: "2026-09-24" } })
  assert.equal(patches["Tanggal Memo\nPembelian"], "2026-09-24")
  assert.ok(!Object.hasOwn(patches, "Tanggal Memo"))
  assert.equal(slaRow, 3)
})

test("snapshot memakai tanggal kalender spreadsheet, bukan tanggal UTC sebelumnya", () => {
  const backend = vm.createContext({ Date })
  vm.runInContext(backendSource, backend)
  const date = new Date("2026-09-23T17:00:00.000Z") // 24 September di Jakarta
  backend.procurementActor_ = () => ({})
  backend.procurementResolveDataset_ = () => ({ masterSheet: "Master" })
  backend.getSpreadsheet_ = () => ({
    getName: () => "Test", getSpreadsheetTimeZone: () => "Asia/Jakarta",
    getSheetByName: name => name === "Master" ? { getDataRange: () => ({ getValues: () => [["Tanggal Memo Pembelian"], [date]] }) } : null,
  })
  backend.Utilities = { formatDate(value, zone, format) {
    assert.equal(zone, "Asia/Jakarta")
    assert.equal(format, "yyyy-MM-dd")
    return new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit" }).format(value)
  } }
  assert.equal(backend.procurementGetWorkspace_({}).data.sheets["MASTER DATABASE PENGADAAN"][1][0], "2026-09-24")
  assert.equal(backend.procurementFirstHeader_(["Tanggal Memo", "Tanggal Memo\nPembelian"], ["Tanggal Memo Pembelian", "Tanggal Memo"]), "Tanggal Memo\nPembelian")
})
