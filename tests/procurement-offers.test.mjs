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
