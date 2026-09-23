import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../lib/procurement-offers.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { syncWinnerToPo } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
const offer = { vendor: "Vendor A", initialOffer: 1000, finalOffer: 800, winner: true }
const record = { procurementMethod: "Pemilihan Langsung", offers: [offer], selectedVendor: "Old", initialPriceExcl: 5, poAmountExcl: 3 }

test("winner selection and edits immediately update PO, including zero values", () => {
  const selected = syncWinnerToPo(record)
  assert.equal(selected.selectedVendor, "Vendor A")
  assert.equal(selected.initialPriceExcl, 1000)
  assert.equal(selected.poAmountExcl, 800)
  assert.equal(selected.poAmountIncl, 800 * 1.11)
  assert.equal(selected.efficiency, 200 * 1.11)
  const switched = syncWinnerToPo({ ...record, offers: [{ ...offer, winner: false }, { vendor: "Vendor B", winner: true, initialOffer: 0, finalOffer: 0 }] })
  assert.equal(switched.selectedVendor, "Vendor B")
  assert.equal(switched.initialPriceExcl, 0)
  assert.equal(switched.poAmountExcl, 0)
})

test("removing or deselecting winner clears derived PO while manual PO remains available", () => {
  const cleared = syncWinnerToPo({ ...record, offers: [] }, true)
  assert.equal(cleared.selectedVendor, "")
  assert.equal(cleared.poAmountExcl, 0)
  const manual = { ...record, offers: [] }
  assert.equal(syncWinnerToPo(manual), manual)
  const direct = { ...record, procurementMethod: "Penunjukan Langsung" }
  assert.equal(syncWinnerToPo(direct), direct)
})

const backend = await readFile(new URL("../integration/portal-apps-script/ProcurementReview.gs", import.meta.url), "utf8")
const context = vm.createContext({})
vm.runInContext(backend, context)
test("header migration preserves values, column positions, and is safe to repeat", () => {
  const grid = [["Nomor Request", "Nama", "Harga Awal Excl. PPN", "Amount PO Excl. PPN"], ["PROC-1", "Requestor", 1000, 800]]
  const sheet = {
    getLastColumn: () => grid[0].length,
    getLastRow: () => grid.length,
    getRange: (row, col) => ({ getDisplayValues: () => grid.map((r) => r.map(String)), setValue: (value) => { grid[row - 1][col - 1] = value } }),
  }
  context.procurementMigrateInputHeaders_(sheet, "Nomor Request")
  context.procurementMigrateInputHeaders_(sheet, "Nomor Request")
  assert.deepEqual(grid[0], ["Nomor Request", "Nama Requestor", "Penawaran Awal Excl. PPN", "Penawaran Akhir Excl. PPN"])
  assert.deepEqual(grid[1], ["PROC-1", "Requestor", 1000, 800])
})
import { createRequire } from "node:module"
import * as XLSX from "xlsx"
const nodeRequire = createRequire(import.meta.url)
const parser = vm.createContext({ exports: {}, require: name => name === "./indonesian-date.ts" ? nodeRequire("../lib/indonesian-date.ts") : nodeRequire(name), Date })
const dataSource = await readFile(new URL("../lib/procurement-data.ts", import.meta.url), "utf8")
vm.runInContext(ts.transpileModule(dataSource + "\nexport { parseMaster, mergeDynamicOffers };", { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, parser)
test("legacy and renamed spreadsheet headers retain requestor, prices, and participant offers", () => {
  for (const legacy of [true, false]) {
    const master = XLSX.utils.aoa_to_sheet([
      ["Nomor Request", "Item", legacy ? "Nama" : "Nama Requestor", "Metode Pengadaan", legacy ? "Harga Awal Excl. PPN" : "Penawaran Awal Excl. PPN", legacy ? "Amount PO Excl. PPN" : "Penawaran Akhir Excl. PPN"],
      ["REQ-1", "Laptop", "Requestor A", legacy ? "Tender" : "Pemilihan Langsung", 1000, 800],
    ])
    const offers = XLSX.utils.aoa_to_sheet([
      ["Request ID", "Vendor", "Penawaran Awal", legacy ? "Harga Final/Nego" : "Penawaran Akhir", "Pemenang"],
      ["REQ-1", "Vendor A", 1000, 800, "Ya"],
    ])
    const records = parser.exports.mergeDynamicOffers({ Sheets: { "PENAWARAN VENDOR": offers } }, parser.exports.parseMaster(master))
    assert.equal(records[0].picName, "Requestor A")
    assert.equal(records[0].procurementMethod, "Pemilihan Langsung")
    assert.equal(records[0].initialPriceExcl, 1000)
    assert.equal(records[0].poAmountExcl, 800)
    assert.equal(records[0].offers[0].finalOffer, 800)
    assert.equal(records[0].offers[0].winner, true)
  }
})

function memorySheet(initial) {
  const grid = initial.map(row => [...row])
  const sheet = {
    getLastColumn: () => Math.max(...grid.map(row => row.length)),
    getLastRow: () => grid.length,
    getDataRange: () => ({ getValues: () => grid.map(row => [...row]), getDisplayValues: () => grid.map(row => row.map(String)) }),
    getRange(row, column, height = 1, width = 1) {
      const range = {
        getDisplayValues: () => Array.from({ length: height }, (_, r) => Array.from({ length: width }, (_, c) => String(grid[row + r - 1]?.[column + c - 1] ?? ""))),
        setValues(values) { values.forEach((cells, r) => cells.forEach((value, c) => { grid[row + r - 1] ??= []; grid[row + r - 1][column + c - 1] = value })); return range },
        setValue(value) { return range.setValues([[value]]) },
        clearContent() { return range.setValues(Array.from({ length: height }, () => Array(width).fill(""))) },
      }
      return range
    },
  }
  return { grid, sheet }
}

function storageBackend(sheet) {
  const backend = vm.createContext({})
  vm.runInContext(backendSourceForStorage, backend)
  backend.getSpreadsheet_ = () => ({ getSheetByName: () => sheet })
  return backend
}
const backendSourceForStorage = backend
const offerHeaders = ["Request ID", "Vendor", "Penawaran Awal", "Penawaran Akhir", "Pemenang"]
const dataset = { offersSheet: "PENAWARAN VENDOR 2026" }
const participants = [
  { vendor: "A", initialOffer: 100, finalOffer: 80, taxRate: 0.11, winner: true },
  { vendor: "B", initialOffer: 200, finalOffer: 170, taxRate: 0.11, winner: false },
  { vendor: "C", initialOffer: 300, finalOffer: 250, taxRate: 0.11, winner: false },
]

test("saving more vendors than existing bottom rows does not overwrite reused rows", () => {
  const { sheet, grid } = memorySheet([offerHeaders, ["OTHER", "Other", 5, 4, "Ya"], ["REQ-1", "Old", 10, 8, "Ya"]])
  const storage = storageBackend(sheet)
  storage.procurementReplaceOffers_({ requestId: "REQ-1", offers: participants }, dataset)
  assert.deepEqual(grid.slice(2).map(row => row[1]), ["A", "B", "C"])
  assert.equal(grid[1][1], "Other")
  const records = [{ recordUid: "record", requestId: "REQ-1", offers: [{ vendor: "Stale master vendor" }] }]
  parser.exports.mergeDynamicOffers({ Sheets: { "PENAWARAN VENDOR": XLSX.utils.aoa_to_sheet(grid) } }, records)
  assert.deepEqual(Array.from(records[0].offers, offer => [offer.vendor, offer.initialOffer, offer.finalOffer, offer.winner]), [["A", 100, 80, true], ["B", 200, 170, false], ["C", 300, 250, false]])
  storage.procurementReplaceOffers_({ requestId: "REQ-1", offers: participants.slice(0, 1) }, dataset)
  assert.equal(grid.filter(row => row[0] === "REQ-1").length, 1)
})

test("missing offer sheet fails explicitly rather than reporting a successful save", () => {
  const storage = storageBackend(null)
  assert.throws(() => storage.procurementReplaceOffers_({ requestId: "REQ-1", offers: participants }, dataset), /SHEET_NOT_FOUND.*PENAWARAN VENDOR 2026/)
})

test("missing price headers are created and values are persisted", () => {
  const { sheet, grid } = memorySheet([["Request ID", "Vendor"]])
  storageBackend(sheet).procurementReplaceOffers_({ requestId: "REQ-1", offers: participants }, dataset)
  assert.equal(grid[1][grid[0].indexOf("Penawaran Akhir")], 80)
  assert.equal(grid[3][grid[0].indexOf("Penawaran Awal")], 300)
})

test("legacy master participant columns update and removed participants are cleared", () => {
  const headers = ["Vendor 1", "Penawaran Vendor 1 ", "Nego Harga Vendor 1", "Vendor 2", "Penawaran Vendor 2", "Nego Harga Vendor 2", "Item"]
  const patches = context.procurementLegacyOfferPatches_(headers, participants.slice(0, 1))
  assert.deepEqual(JSON.parse(JSON.stringify(patches)), { "Vendor 1": "A", "Penawaran Vendor 1 ": 100, "Nego Harga Vendor 1": 80, "Vendor 2": "", "Penawaran Vendor 2": "", "Nego Harga Vendor 2": "" })
})
