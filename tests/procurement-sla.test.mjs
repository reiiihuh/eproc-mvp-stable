import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../lib/procurement-sla.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const { calculateSlaMetrics } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`)

test("SLA hanya memakai proyek dengan pasangan tanggal valid", () => {
  const records = [
    { memoDate: "2026-01-01", directorApprovalDate: "2026-01-05", fpcSentDate: "2026-01-06", fpcApprovalDate: "2026-01-09", poDate: "2026-01-11" },
    { memoDate: "2026-02-01", directorApprovalDate: "2026-02-07", fpcSentDate: "", fpcApprovalDate: "", poDate: "2026-02-13" },
    { memoDate: "", directorApprovalDate: "", fpcSentDate: "2026-03-05", fpcApprovalDate: "2026-03-04", poDate: "" },
  ]
  const [memo, fpc, procurement] = calculateSlaMetrics(records)
  assert.deepEqual({ average: memo.averageDays, valid: memo.calculable, missing: memo.unavailable }, { average: 5, valid: 2, missing: 1 })
  assert.deepEqual({ average: fpc.averageDays, valid: fpc.calculable, missing: fpc.unavailable }, { average: 3, valid: 1, missing: 2 })
  assert.deepEqual({ average: procurement.averageDays, valid: procurement.calculable, missing: procurement.unavailable }, { average: 11, valid: 2, missing: 1 })
})

test("parser dan backend mempertahankan empat tanggal SLA", async () => {
  const parser = await readFile(new URL("../lib/procurement-data.ts", import.meta.url), "utf8")
  const backend = await readFile(new URL("../integration/portal-apps-script/ProcurementReview.gs", import.meta.url), "utf8")
  for (const header of ["Tanggal Memo", "Tanggal Persetujuan Direksi", "Tanggal Send FPC", "Tanggal Approval FPC"]) {
    assert.match(parser, new RegExp(header))
    assert.match(backend, new RegExp(header))
  }
})
