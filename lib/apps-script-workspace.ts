import * as XLSX from "xlsx"

import { XlsxWorkspaceAdapter } from "./procurement-data"
import type { AppsScriptPortalReviewRepository } from "./portal-review-repository"
import type { ProcurementPic, ProcurementRecord, ProcurementVendor, ProcurementWorkspace, TenderScorecard, WorkspaceSettings } from "./procurement-types"

/** Adapter master tanpa OAuth Sheets tambahan; otorisasi mengikuti sesi admin Apps Script. */
export class AppsScriptWorkspaceAdapter {
  constructor(private readonly repository: AppsScriptPortalReviewRepository) {}

  async loadWorkspace(settings: WorkspaceSettings, scorecards: TenderScorecard[] = []): Promise<ProcurementWorkspace> {
    const snapshot = await this.repository.getProcurementWorkspace()
    const workbook = XLSX.utils.book_new()
    for (const [title, rows] of Object.entries(snapshot.sheets)) {
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), title)
    }
    const bytes = XLSX.write(workbook, { type: "array", bookType: "xlsx" })
    const file = new File([bytes], `${snapshot.title}.xlsx`, { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    const loaded = await new XlsxWorkspaceAdapter().import(file, settings, scorecards)
    return { ...loaded, sourceName: snapshot.title }
  }

  async upsertProcurement(record: ProcurementRecord, mode: "create" | "edit" = "create") {
    const result = await this.repository.upsertProcurementRecord(record, mode)
    return { ...record, requestId: result.requestId || record.requestId, sourceRow: result.sourceRow }
  }

  async deleteProcurement(record: ProcurementRecord) {
    await this.repository.deleteProcurementRecords([record])
  }

  async deleteProcurements(records: ProcurementRecord[]) {
    await this.repository.deleteProcurementRecords(records)
  }

  async upsertPic(pic: ProcurementPic) {
    const result = await this.repository.upsertProcurementPic(pic)
    return { ...pic, ...result }
  }

  async deletePic(pic: ProcurementPic) { await this.repository.deleteProcurementPics([pic]) }
  async deletePics(pics: ProcurementPic[]) { await this.repository.deleteProcurementPics(pics) }

  async upsertVendor(vendor: ProcurementVendor) {
    const result = await this.repository.upsertProcurementVendor(vendor)
    return { ...vendor, ...result }
  }

  async deleteVendor(vendor: ProcurementVendor) { await this.repository.deleteProcurementVendors([vendor]) }
  async deleteVendors(vendors: ProcurementVendor[]) { await this.repository.deleteProcurementVendors(vendors) }
}
