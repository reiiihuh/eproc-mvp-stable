import type { ProcurementSession, PortalReviewDetail, PortalReviewRequest } from "./portal-review-types"
import type { ProcurementDataset, ProcurementPic, ProcurementRecord, ProcurementVendor } from "./procurement-types"

export type ProcurementWorkspaceSnapshot = { title: string; sheets: Record<string, unknown[][]>; dataset?: ProcurementDataset }

export interface PortalReviewRepository {
  getSession(): Promise<ProcurementSession>
  listReviewQueue(): Promise<PortalReviewRequest[]>
  getRequestDetail(requestId: string): Promise<PortalReviewDetail>
  startReview(requestId: string): Promise<PortalReviewDetail>
  reviewDocument(requestId: string, documentId: string, status: "VALID" | "REVISION_REQUIRED", note: string): Promise<PortalReviewDetail>
  requestClarification(requestId: string, note: string): Promise<PortalReviewDetail>
  approveRequest(requestId: string, note: string): Promise<PortalReviewDetail>
  rejectRequest(requestId: string, note: string): Promise<PortalReviewDetail>
  submitReview(requestId: string, decision: "REVISION" | "APPROVE" | "REJECT", note: string, reviews: { documentId: string; status: "VALID" | "REVISION_REQUIRED"; note: string }[]): Promise<PortalReviewDetail>
  promoteToProcurement(requestId: string): Promise<PortalReviewDetail>
  syncProcurementStatus(masterRequestId: string, status: string, poNumber: string, poUrl: string): Promise<void>
  flushPendingStatusSyncs(): Promise<void>
  getProcurementWorkspace(): Promise<ProcurementWorkspaceSnapshot>
  listProcurementDatasets(): Promise<ProcurementDataset[]>
  setProcurementDataset(datasetKey: string): void
  prepareProcurementDataset(year: number): Promise<ProcurementDataset[]>
  activateProcurementDataset(datasetKey: string): Promise<ProcurementDataset[]>
  archiveProcurementDataset(datasetKey: string): Promise<ProcurementDataset[]>
  resetProcurementSandbox(datasetKey: string, confirmation: string): Promise<ProcurementDataset[]>
  upsertProcurementRecord(record: ProcurementRecord, mode?: "create" | "edit"): Promise<{ sourceRow: number; requestId?: string }>
  deleteProcurementRecords(records: ProcurementRecord[]): Promise<void>
  upsertProcurementPic(pic: ProcurementPic): Promise<{ id: string; sourceRow: number }>
  deleteProcurementPics(pics: ProcurementPic[]): Promise<void>
  upsertProcurementVendor(vendor: ProcurementVendor): Promise<{ id: string; sourceRow: number }>
  deleteProcurementVendors(vendors: ProcurementVendor[]): Promise<void>
}

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: string; message?: string }

/** Adapter tunggal untuk seluruh komunikasi review; komponen React tidak mengenal detail Apps Script. */
export class AppsScriptPortalReviewRepository implements PortalReviewRepository {
  private queueCache?: { at: number; data: PortalReviewRequest[] }
  private workspaceCache?: { at: number; data: ProcurementWorkspaceSnapshot }
  private workspacePromise?: Promise<ProcurementWorkspaceSnapshot>
  private sessionPromise?: Promise<ProcurementSession>
  private datasetKey = ""
  constructor(private readonly endpoint: string, private readonly idToken: string) {}

  private async call<T>(action: string, payload: Record<string, unknown> = {}) {
    const retryable = ["getProcurementSession", "listReviewQueue", "getProcurementRequestDetail", "getProcurementWorkspace", "listProcurementDatasets", "syncProcurementStatus"].includes(action)
    let lastError: unknown
    // Proxy same-origin sudah menangani retry. Hindari retry bertingkat yang dapat
    // membuat sampai empat eksekusi Apps Script untuk satu aksi browser.
    const attempts = retryable && !this.endpoint.startsWith("/api/") ? 2 : 1
    for (let attempt = 0; attempt < attempts; attempt++) {
      const controller = new AbortController()
      const timeout = window.setTimeout(() => controller.abort(), this.endpoint.startsWith("/api/") ? 40_000 : 25_000)
      try {
        const response = await fetch(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify({ action, idToken: this.idToken, ...payload }),
          signal: controller.signal,
        })
        const result = await response.json().catch(() => ({ ok: false, message: `Backend portal tidak dapat dihubungi (${response.status}).` })) as ApiEnvelope<T>
        if (!response.ok) throw new Error(result.message || `Backend portal tidak dapat dihubungi (${response.status}).`)
        if (!result.ok || result.data === undefined) throw new Error(result.message || result.error || "Permintaan backend ditolak.")
        return result.data
      } catch (error) {
        lastError = error
        if (!retryable || attempt >= attempts - 1) break
        await new Promise((resolve) => window.setTimeout(resolve, 500 + attempt * 400))
      } finally { window.clearTimeout(timeout) }
    }
    if (lastError instanceof DOMException && lastError.name === "AbortError") throw new Error("Apps Script terlalu lama merespons. Coba lagi; perubahan yang sudah tersimpan tidak hilang.")
    throw lastError instanceof Error ? lastError : new Error("Backend portal tidak dapat dihubungi.")
  }

  private pendingStatuses() {
    try { return JSON.parse(localStorage.getItem("eproc.pending-portal-status-sync") || "{}") as Record<string, { masterRequestId: string; status: string; poNumber: string; poUrl: string }> }
    catch { return {} }
  }

  private savePendingStatuses(items: Record<string, { masterRequestId: string; status: string; poNumber: string; poUrl: string }>) {
    localStorage.setItem("eproc.pending-portal-status-sync", JSON.stringify(items))
  }

  private async write<T>(action: string, payload: Record<string, unknown>) {
    const result = await this.call<T>(action, payload)
    this.queueCache = undefined
    this.workspaceCache = undefined
    this.workspacePromise = undefined
    return result
  }

  getSession() {
    this.sessionPromise ??= this.call<ProcurementSession>("getProcurementSession").catch((error) => {
      this.sessionPromise = undefined
      throw error
    })
    return this.sessionPromise
  }
  async listReviewQueue() {
    if (this.queueCache && Date.now() - this.queueCache.at < 15_000) return this.queueCache.data
    const data = await this.call<PortalReviewRequest[]>("listReviewQueue")
    this.queueCache = { at: Date.now(), data }
    return data
  }
  getRequestDetail(requestId: string) { return this.call<PortalReviewDetail>("getProcurementRequestDetail", { requestId }) }
  startReview(requestId: string) { return this.write<PortalReviewDetail>("procurement.startReview", { requestId }) }
  reviewDocument(requestId: string, documentId: string, status: "VALID" | "REVISION_REQUIRED", note: string) { return this.write<PortalReviewDetail>("procurement.reviewDocument", { requestId, documentId, status, note }) }
  requestClarification(requestId: string, note: string) { return this.write<PortalReviewDetail>("procurement.requestRevision", { requestId, note }) }
  approveRequest(requestId: string, note: string) { return this.write<PortalReviewDetail>("procurement.approve", { requestId, note }) }
  rejectRequest(requestId: string, note: string) { return this.write<PortalReviewDetail>("procurement.reject", { requestId, note }) }
  submitReview(requestId: string, decision: "REVISION" | "APPROVE" | "REJECT", note: string, reviews: { documentId: string; status: "VALID" | "REVISION_REQUIRED"; note: string }[]) { return this.write<PortalReviewDetail>("procurement.submitReview", { requestId, decision, note, reviews }) }
  promoteToProcurement(requestId: string) { return this.write<PortalReviewDetail>("procurement.promote", { requestId }) }
  setProcurementDataset(datasetKey: string) {
    if (this.datasetKey === datasetKey) return
    this.datasetKey = datasetKey
    this.workspaceCache = undefined
    this.workspacePromise = undefined
  }
  listProcurementDatasets() { return this.call<ProcurementDataset[]>("listProcurementDatasets") }
  prepareProcurementDataset(year: number) { return this.write<ProcurementDataset[]>("procurement.prepareDataset", { year }) }
  activateProcurementDataset(datasetKey: string) { return this.write<ProcurementDataset[]>("procurement.activateDataset", { datasetKey }) }
  archiveProcurementDataset(datasetKey: string) { return this.write<ProcurementDataset[]>("procurement.archiveDataset", { datasetKey }) }
  resetProcurementSandbox(datasetKey: string, confirmation: string) { return this.write<ProcurementDataset[]>("procurement.resetSandboxDataset", { datasetKey, confirmation }) }
  getProcurementWorkspace() {
    if (this.workspaceCache && Date.now() - this.workspaceCache.at < 15_000) return Promise.resolve(this.workspaceCache.data)
    this.workspacePromise ??= this.call<ProcurementWorkspaceSnapshot>("getProcurementWorkspace", { datasetKey: this.datasetKey }).then((data) => {
      this.workspaceCache = { at: Date.now(), data }
      return data
    }).finally(() => { this.workspacePromise = undefined })
    return this.workspacePromise
  }
  upsertProcurementRecord(record: ProcurementRecord, mode: "create" | "edit" = "create") { return this.write<{ sourceRow: number; requestId?: string }>("procurement.upsertRecord", { record, mode, datasetKey: this.datasetKey }) }
  async deleteProcurementRecords(records: ProcurementRecord[]) {
    await this.write<Record<string, unknown>>("procurement.deleteRecords", { datasetKey: this.datasetKey, records: records.map((record) => ({ sourceRow: record.sourceRow, requestId: record.requestId, originalRequestId: record.originalRequestId })) })
  }
  upsertProcurementPic(pic: ProcurementPic) { return this.write<{ id: string; sourceRow: number }>("procurement.upsertPic", { pic }) }
  async deleteProcurementPics(pics: ProcurementPic[]) {
    await this.write<Record<string, unknown>>("procurement.deletePics", { pics: pics.map((pic) => ({ id: pic.id, name: pic.name, sourceRow: pic.sourceRow })) })
  }
  upsertProcurementVendor(vendor: ProcurementVendor) { return this.write<{ id: string; sourceRow: number }>("procurement.upsertVendor", { vendor }) }
  async deleteProcurementVendors(vendors: ProcurementVendor[]) {
    await this.write<Record<string, unknown>>("procurement.deleteVendors", { vendors: vendors.map((vendor) => ({ name: vendor.name, sourceRow: vendor.sourceRow })) })
  }
  async syncProcurementStatus(masterRequestId: string, status: string, poNumber: string, poUrl: string) {
    const pending = this.pendingStatuses()
    pending[masterRequestId] = { masterRequestId, status, poNumber, poUrl }
    this.savePendingStatuses(pending)
    await this.call<Record<string, unknown>>("syncProcurementStatus", pending[masterRequestId])
    const latest = this.pendingStatuses()
    if (latest[masterRequestId]?.status === status && latest[masterRequestId]?.poNumber === poNumber && latest[masterRequestId]?.poUrl === poUrl) {
      delete latest[masterRequestId]
      this.savePendingStatuses(latest)
    }
  }

  async flushPendingStatusSyncs() {
    const pending = this.pendingStatuses()
    for (const item of Object.values(pending)) {
      try { await this.syncProcurementStatus(item.masterRequestId, item.status, item.poNumber, item.poUrl) }
      catch { /* antrean localStorage dicoba lagi pada interval berikutnya */ }
    }
  }
}
