import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../lib/procurement-sla-formulas.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { procurementSlaFormulas } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)
const backend = await readFile(new URL("../integration/portal-apps-script/ProcurementReview.gs", import.meta.url), "utf8")
const context = vm.createContext({})
vm.runInContext(backend, context)
const headers = ["Nomor Request", "Tanggal Request", "Tanggal Memo", "Tanggal Send FPC", "Tanggal Approval FPC", "Tanggal PO", "SLA Proses Pengadaan", "SLA 5 Hari Kerja\nApproval Memo", "SLA FPC 5 Hari Kerja", "SLA dari awal sampai PO Hari Kerja", "SLA tidak dikenal"]

test("kedua backend menghasilkan rumus identik pada kolom SLA yang tersedia", () => {
  for (const layout of [headers, [...headers].reverse(), [...Array(55).fill(""), ...headers]]) {
    const formulas = procurementSlaFormulas(layout, 12)
    assert.deepEqual(JSON.parse(JSON.stringify(context.procurementSlaFormulas_(layout, 12))), formulas)
    assert.equal(Object.keys(formulas).length, 4)
    assert.equal(formulas["SLA tidak dikenal"], undefined)
    for (const formula of Object.values(formulas)) {
      assert.match(formula, /^=IFERROR\(IF\(OR\(/)
      assert.match(formula, /DATEVALUE\(/)
      assert.match(formula, /NETWORKDAYS\(.+\)-NETWORKDAYS\(/)
    }
  }
  const formulas = procurementSlaFormulas(headers, 12)
  for (const [header, start, end] of [[headers[6], "B12", "C12"], [headers[7], "C12", "D12"], [headers[8], "D12", "E12"], [headers[9], "B12", "F12"]]) {
    assert.ok(formulas[header].includes(`OR(${start}="",${end}=""`))
  }
  assert.deepEqual(procurementSlaFormulas(["SLA FPC 5 Hari Kerja"], 3), {})
})

test("penulisan SLA memakai formula dan format angka, bukan hasil hitungan dashboard", () => {
  const writes = []
  context.procurementWriteSlaFormulas_({ getRange(row, column) {
    const write = { row, column }
    writes.push(write)
    return { setFormula(formula) { write.formula = formula; return this }, setNumberFormat(format) { write.format = format; return this } }
  } }, 8, headers)
  assert.equal(writes.length, 4)
  assert.deepEqual(writes.map(w => w.column), [7, 8, 9, 10])
  assert.ok(writes.every(w => w.row === 8 && w.format === "0" && w.formula.startsWith("=IFERROR")))
})

test("backfill mengisi record lama dan mempertahankan baris kosong", () => {
  const rows = [["REQ-1"], [""], ["REQ-2"]]
  const writes = []
  const sheet = {
    getLastRow: () => 5, getLastColumn: () => headers.length,
    getRange(row, column, count, width) {
      if (width === headers.length) return { getValues: () => rows }
      return {
        getFormulas: () => [[""], ["=99"], [""]], getValues: () => [[""], [99], [""]],
        setValues(values) { writes.push({ column, values }); return this }, setNumberFormat() { return this },
      }
    },
  }
  context.portalWithLock_ = fn => fn()
  context.getSpreadsheet_ = () => ({ getSheetByName: () => sheet })
  context.procurementDatasetRows_ = () => [{ masterSheet: "Master" }, { masterSheet: "Master" }]
  context.procurementMasterContext_ = () => ({ headers, headerRow: 2 })
  context.SpreadsheetApp = { flush() {} }
  assert.equal(context.backfillProcurementSlaFormulas(), "8 sel SLA sudah diisi rumus.")
  assert.equal(writes.length, 4)
  assert.ok(writes.every(w => w.values[1][0] === "=99" && w.values[0][0].includes("B3") === (w.column === 7 || w.column === 10)))
  assert.ok(writes.every(w => w.values[2][0].includes("5")))
})
