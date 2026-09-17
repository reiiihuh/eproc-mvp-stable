/**
 * Shared domain contracts. UI and storage adapters depend on these types, but
 * the types do not depend on React, Excel, Google APIs, or a future database.
 */
export type ProcurementStatus =
  | "Upcoming"
  | "Ongoing"
  | "PO"
  | "Complete"
  | "Dropped"

export type TenderOffer = {
  id: string
  vendor: string
  initialOffer: number
  bafo: number
  finalOffer: number
  taxRate: number
  technicalPass: boolean
  winner: boolean
  quotationLink?: string
}

export type ProcurementDocument = {
  id: string
  name: string
  type: string
  driveFileId?: string
  webViewLink?: string
  state: "local" | "uploaded" | "pending"
}

export type ProcurementPic = {
  id: string
  sourceRow?: number
  name: string
  division: string
  position: string
  location: string
  email: string
  active: boolean
}

export type ProcurementVendor = {
  id: string
  sourceRow?: number
  name: string
  priority: string
  documentStatus: string
  bankAccountCommitment: string
  bankName: string
  bankAccountNumber: string
  address: string
  services: string
  picName: string
  phone: string
  email: string
  position: string
  criticality: string
  category: string
  goodsOrServices: string
  agreementStatus: string
  notes: string
}

export type ProcurementCurrency = "IDR" | "USD" | "SGD"
export type ProcurementBudgetType = "CAPEX" | "OPEX" | "BANK WIDE"

export type ScoringScheme = "normalized" | "weighted" | "custom"

export type ScoringVendor = {
  id: string
  name: string
  initialPrice: number
  finalPrice: number
  technicalScore: number
  notes: string
}

export type TenderScorecard = {
  id: string
  projectName: string
  requestId: string
  scoringDate: string
  evaluator: string
  scheme: ScoringScheme
  technicalWeight: number
  commercialWeight: number
  technicalMaxScore: number
  commercialMaxScore: number
  includeApproval?: boolean
  vendors: ScoringVendor[]
}

export type ProcurementRecord = {
  recordUid: string
  requestId: string
  originalRequestId?: string
  sourceRow?: number
  requestDate: string
  status: ProcurementStatus
  statusNotes?: string
  picName: string
  division: string
  position: string
  email: string
  location: string
  requestType: string
  itemName: string
  description: string
  quantity: number
  category: string
  requestKind: string
  periodStart?: string
  periodEnd?: string
  procurementMethod: string
  budget: number
  budgetType?: ProcurementBudgetType
  budgetCode: string
  selectedVendor: string
  poNumber: string
  poDate?: string
  memoDate?: string
  directorApprovalDate?: string
  fpcSentDate?: string
  fpcApprovalDate?: string
  poAmountExcl: number
  initialPriceExcl?: number
  poAmountIncl: number
  efficiency: number
  currency: ProcurementCurrency
  offers: TenderOffer[]
  documents: ProcurementDocument[]
}

export type WorkspaceSettings = {
  requestIdPattern: string
  driveClientId: string
  driveRootFolder: string
  sheetsSpreadsheetUrl: string
  defaultPageSize?: 10 | 25 | 50 | 100
  autoRefreshSeconds?: 0 | 30 | 60 | 120
}

export type ProcurementWorkspace = {
  version: 1
  importedAt: string
  sourceName: string
  settings: WorkspaceSettings
  pics: ProcurementPic[]
  vendors: ProcurementVendor[]
  scorecards: TenderScorecard[]
  records: ProcurementRecord[]
}

export const STATUS_ORDER: ProcurementStatus[] = [
  "Upcoming",
  "Ongoing",
  "PO",
  "Complete",
  "Dropped",
]
