import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const dataSource = fs.readFileSync(new URL("../lib/procurement-data.ts", import.meta.url), "utf8")
const sheetsSource = fs.readFileSync(new URL("../lib/google-sheets.ts", import.meta.url), "utf8")
const repositorySource = fs.readFileSync(new URL("../lib/portal-review-repository.ts", import.meta.url), "utf8")
const reviewSource = fs.readFileSync(new URL("../integration/portal-apps-script/ProcurementReview.gs", import.meta.url), "utf8")

test("portal and master preserve one request number", () => {
  assert.match(dataSource, /const requestId = asText\(item\["Nomor Request"\]\)/)
  assert.match(dataSource, /const originalRequestId = asText\(item\["Request ID Asli"\]\) \|\| requestId/)
  assert.match(sheetsSource, /const sheetRequestId = record\.requestId/)
  assert.doesNotMatch(sheetsSource, /ensureHeader\([^\n]*"Request ID Asli"/)
  assert.doesNotMatch(sheetsSource, /"Request ID Asli": record\.originalRequestId/)
  assert.match(reviewSource, /var masterId = portalRequestNumber/)
  assert.doesNotMatch(reviewSource, /hasOriginalRequestId\s*\?\s*procurementNextMasterId_/)
})

test("failed portal status sync is queued and retried idempotently", () => {
  assert.match(repositorySource, /eproc\.pending-portal-status-sync/)
  assert.match(repositorySource, /flushPendingStatusSyncs/)
  assert.match(reviewSource, /unchanged: true/)
  assert.match(reviewSource, /masterStatus === "PO"/)
  assert.match(reviewSource, /"DROPPED", "CANCELLED", "CANCELED"/)
})
