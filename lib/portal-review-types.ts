export type ProcurementRole = "PROCUREMENT_ADMIN"

export type ProcurementSession = {
  email: string
  name: string
  role: ProcurementRole
  picture?: string
  spreadsheetId?: string
}

export type PortalReviewRequest = {
  requestId: string
  requestNumber: string
  requestType: string
  requesterName: string
  requesterEmail: string
  requesterDivision: string
  requesterPosition: string
  requesterLocation: string
  requesterNotes: string
  status: string
  submittedAt: string
  updatedAt: string
  masterRequestId: string
}

export type PortalReviewDocument = {
  documentId: string
  type: string
  required: boolean
  versionNumber: number
  reviewStatus: string
  reviewNote: string
  fileName: string
  fileUrl: string
  reviewedAt: string
  reviewedBy: string
}

export type PortalStatusLog = {
  id: string
  eventType: string
  oldStatus: string
  newStatus: string
  at: string
  actorName: string
  actorEmail: string
  note: string
}

export type PortalReviewDetail = {
  request: PortalReviewRequest
  documents: PortalReviewDocument[]
  logs: PortalStatusLog[]
}
