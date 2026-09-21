import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

test("frontend tidak menentukan email atau role admin sendiri", async () => {
  const gate = await read("components/procurement/procurement-access-gate.tsx")
  const repository = await read("lib/portal-review-repository.ts")
  assert.match(gate, /repository\.getSession\(\)/)
  assert.doesNotMatch(gate, /endsWith\(/)
  assert.match(repository, /idToken: this\.idToken/)
})

test("Apps Script memverifikasi role dan menjaga promotion idempotent", async () => {
  const backend = await read("integration/portal-apps-script/ProcurementReview.gs")
  assert.match(backend, /portalIdentity_\(body\)/)
  assert.match(backend, /ROLE\)\.toUpperCase\(\) !== "PROCUREMENT_ADMIN"/)
  assert.match(backend, /if \(request\.MASTER_REQUEST_ID\)/)
  assert.match(backend, /Request ID Asli/)
  assert.match(backend, /var masterId = portalRequestNumber/)
  assert.match(backend, /String\(request\.REQUEST_NUMBER \|\| ""\)/)
  assert.match(backend, /portalWithLock_/)
  assert.match(backend, /case "getprocurementworkspace": return procurementGetWorkspace_\(body\)/)
  assert.match(backend, /case "procurement\.upsertpic": return procurementUpsertPic_\(body\)/)
  assert.match(backend, /case "procurement\.deletepics": return procurementDeletePics_\(body\)/)
  assert.match(backend, /case "procurement\.upsertvendor": return procurementUpsertVendor_\(body\)/)
  assert.match(backend, /case "procurement\.deletevendors": return procurementDeleteVendors_\(body\)/)
  assert.match(backend, /function procurementUpsertRecord_\(body\)/)
})

test("action review selalu dirutekan melalui repository", async () => {
  const repository = await read("lib/portal-review-repository.ts")
  for (const action of ["listReviewQueue", "startReview", "reviewDocument", "requestClarification", "approveRequest", "rejectRequest", "promoteToProcurement"]) assert.match(repository, new RegExp(action))
  for (const action of ["getProcurementWorkspace", "upsertProcurementRecord", "deleteProcurementRecords"]) assert.match(repository, new RegExp(action))
})

test("master pengadaan, requester, dan vendor memakai Apps Script tanpa OAuth Sheets browser", async () => {
  const app = await read("app/procurement-app.tsx")
  const adapter = await read("lib/apps-script-workspace.ts")
  assert.match(app, /backendWorkspace\.loadWorkspace/)
  assert.match(app, /spreadsheetId: "apps-script"/)
  assert.doesNotMatch(app, /GoogleSheetsWorkspaceAdapter/)
  assert.doesNotMatch(app, /connectSheets/)
  assert.doesNotMatch(app, /requestDriveToken\([^\n]+true\)/)
  assert.match(adapter, /getProcurementWorkspace\(\)/)
  assert.match(adapter, /upsertProcurementRecord\(record, mode\)/)
  assert.match(adapter, /upsertProcurementPic\(pic\)/)
  assert.match(adapter, /upsertProcurementVendor\(vendor\)/)
})

test("halaman login tidak memuat bundle dashboard sebelum autentikasi", async () => {
  const gate = await read("components/procurement/procurement-access-gate.tsx")
  assert.match(gate, /dynamic\(\(\) => import\("@\/app\/procurement-app"\)/)
  assert.doesNotMatch(gate, /import ProcurementApp from/)
})
