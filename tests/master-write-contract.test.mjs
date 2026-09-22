import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import vm from "node:vm"
import test from "node:test"
import ts from "typescript"

const source = await readFile(new URL("../lib/portal-review-repository.ts", import.meta.url), "utf8")
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText

function setup(contract) {
  const calls = []
  const state = { contract }
  const context = vm.createContext({ exports: {}, AbortController, DOMException, window: { setTimeout, clearTimeout }, fetch: async (_url, options) => {
    const payload = JSON.parse(options.body)
    calls.push(payload)
    return { ok: true, json: async () => ({ ok: true, data: payload.action === "getProcurementSession" ? { masterWriteContract: state.contract } : { sourceRow: 3, requestId: "PROC-2026-0003" } }) }
  } })
  vm.runInContext(compiled, context)
  return { calls, state, repository: new context.exports.AppsScriptPortalReviewRepository("/api/apps-script", "test-token") }
}

test("backend lama ditolak sebelum payload record dikirim", async () => {
  for (const version of [undefined, "old"]) {
    const { repository, calls } = setup(version)
    await assert.rejects(repository.upsertProcurementRecord({ requestId: "REQ-1" }, "edit"), /Apps Script versi lama/)
    assert.deepEqual(calls.map(call => call.action), ["getProcurementSession"])
    assert.ok(!Object.hasOwn(calls[0], "record"))
  }
})

test("backend terbaru menerima simpan dan versi diperiksa ulang meskipun sesi login tersimpan", async () => {
  const { repository, state, calls } = setup("nomor-request-memo-pembelian-v1")
  await repository.getSession()
  repository.setProcurementDataset("YEAR-2026")
  await repository.upsertProcurementRecord({ requestId: "REQ-1" }, "edit")
  assert.deepEqual(calls.map(call => call.action), ["getProcurementSession", "getProcurementSession", "procurement.upsertRecord"])
  assert.equal(calls[2].datasetKey, "YEAR-2026")
  assert.equal(calls[2].mode, "edit")
  state.contract = undefined
  await assert.rejects(repository.upsertProcurementRecord({}, "create"), /Apps Script versi lama/)
  assert.equal(calls.filter(call => call.action === "procurement.upsertRecord").length, 1)
})

test("backend melaporkan kontrak penyimpanan yang sama dengan frontend", async () => {
  const backend = await readFile(new URL("../integration/portal-apps-script/ProcurementReview.gs", import.meta.url), "utf8")
  const context = vm.createContext({})
  vm.runInContext(backend, context)
  context.procurementActor_ = () => ({ email: "test@example.com", name: "Test" })
  context.getSpreadsheet_ = () => ({ getId: () => "test-sheet" })
  assert.equal(context.procurementSession_({}).data.masterWriteContract, "nomor-request-memo-pembelian-v1")
})
