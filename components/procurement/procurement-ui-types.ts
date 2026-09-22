export type ProcurementView = "dashboard" | "review" | "master" | "pics" | "vendors" | "vendor_management" | "tender" | "documents" | "admins" | "settings"

export type OperationState = {
  open: boolean
  title: string
  message: string
  step: number
  total: number
  state: "working" | "success" | "error"
}

export type SheetConnection = {
  spreadsheetId: string
  title: string
  lastSyncedAt: string
} | null
