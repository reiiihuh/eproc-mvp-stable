import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("dataset tahunan tetap fallback ke master lama dan merutekan sheet terpilih", async () => {
  const backend = await read("integration/portal-apps-script/ProcurementReview.gs")
  assert.match(backend, /function procurementLegacyDataset_\(\)/)
  assert.match(backend, /masterSheet: "MASTER DATABASE PENGADAAN"/)
  assert.match(backend, /function procurementResolveDataset_\(body\)/)
  assert.match(backend, /dataset\.masterSheet/)
  assert.match(backend, /dataset\.offersSheet/)
  assert.match(backend, /case "procurement\.preparedataset"/)
})

test("reset hanya diizinkan untuk dataset non-legacy nonaktif dan membuat backup", async () => {
  const backend = await read("integration/portal-apps-script/ProcurementReview.gs")
  assert.match(backend, /target\.legacy \|\| target\.active/)
  assert.match(backend, /String\(body\.confirmation \|\| ""\) !== "RESET " \+ target\.key/)
  assert.match(backend, /item\.sheet\.copyTo\(getSpreadsheet_\(\)\)/)
  assert.ok(backend.indexOf("item.sheet.copyTo(getSpreadsheet_())") < backend.indexOf("sheet.getRange(context.headerRow + 1"), "backup harus dibuat sebelum clearContent")
  assert.match(backend, /STATUS: "READY", ENVIRONMENT: "SANDBOX"/)
  assert.match(backend, /LAST_SEQUENCE: 0/)
})

test("dataset archived dapat diaktifkan kembali", async () => {
  const backend = await read("integration/portal-apps-script/ProcurementReview.gs")
  assert.doesNotMatch(backend, /DATASET_ARCHIVED: Dataset arsip tidak dapat diaktifkan/)
  assert.match(backend, /item\.key === target\.key \? "ACTIVE"/)
})

test("Vercel memakai build Nitro dan runtime Node 22", async () => {
  const vite = await read("vite.config.ts")
  const vercel = JSON.parse(await read("vercel.json"))
  const pkg = JSON.parse(await read("package.json"))
  assert.match(vite, /nitro\(\{ preset: "vercel" \}\)/)
  assert.equal(vercel.buildCommand, "npm run build:vercel")
  assert.equal(vercel.outputDirectory, ".vercel/output")
  assert.equal(pkg.engines.node, "22.x")
})
