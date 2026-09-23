"use client"

import { syncWinnerToPo } from "@/lib/procurement-offers"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowDownUp, Building2, ContactRound, FileArchive, FileCheck2, FolderOpen, LayoutDashboard, ListFilter, Plus, Search, Settings, Store, Trash2, Users } from "lucide-react"
import { toast } from "sonner"

import { AddProcurementDialog } from "@/components/procurement/add-procurement-dialog"
import { ProcurementSidebar, type ProcurementNavItem } from "@/components/procurement/app-sidebar"
import { DocumentReview } from "@/components/procurement/document-review"
import { DriveBrowser } from "@/components/procurement/drive-browser"
import { NotificationCenter } from "@/components/procurement/notification-center"
import { OperationDialog } from "@/components/procurement/operation-dialog"
import type { AuthenticatedProcurement } from "@/components/procurement/procurement-access-gate"
import { ProcurementDashboard } from "@/components/procurement/procurement-dashboard"
import { ProcurementSettings } from "@/components/procurement/procurement-settings"
import { ProcurementTable } from "@/components/procurement/procurement-table"
import type { OperationState, ProcurementView, SheetConnection } from "@/components/procurement/procurement-ui-types"
import { PicMasterView, VendorMasterView } from "@/components/procurement/reference-master"
import { ReportExportDialog } from "@/components/procurement/report-export-dialog"
import { TenderScoring } from "@/components/procurement/tender-scoring"
import { VendorManagement } from "@/components/procurement/vendor-management"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/sonner"
import { AppsScriptWorkspaceAdapter } from "@/lib/apps-script-workspace"
import { downloadBlob } from "@/lib/browser-download"
import { requestDriveToken } from "@/lib/google-drive"
import { defaultSettings, XlsxWorkspaceAdapter } from "@/lib/procurement-data"
import type { ProcurementDataset, ProcurementPic, ProcurementRecord, ProcurementVendor, ProcurementWorkspace, TenderOffer } from "@/lib/procurement-types"
import { STATUS_ORDER } from "@/lib/procurement-types"

type MasterSortKey = "requestId" | "description" | "status" | "requestDate" | "picName" | "selectedVendor" | "poNumber" | "poDate" | "poAmountIncl" | "efficiency" | "budget"
const currentYear = new Date().getFullYear()
const compact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 })
const legacyDatasetFallback: ProcurementDataset = { key: "LEGACY", year: currentYear, label: "Master lama", masterSheet: "MASTER DATABASE PENGADAAN", offersSheet: "PENAWARAN VENDOR", documentsSheet: "DOKUMEN PENGADAAN", status: "ACTIVE", environment: "LEGACY", active: true, lastSequence: 0, legacy: true }

const demoRecords: ProcurementRecord[] = [
  { recordUid: "demo-001", requestId: "PROC-2026-0001", originalRequestId: "RFP/IT/001", requestDate: "2026-01-08", status: "Complete", picName: "Danny Adi Saputra", division: "IT Strategy & GRC", position: "Department Head", email: "danny@example.com", location: "Head Office", requestType: "Project", itemName: "Managed Security Monitoring", description: "Layanan monitoring keamanan 24x7.", quantity: 1, category: "Subscription", requestKind: "Renewal", procurementMethod: "Pemilihan Langsung", budget: 700000000, budgetCode: "IT-SEC-2026", selectedVendor: "Vendor Beta", poNumber: "PO-IT-2026-0001", poDate: "2026-02-14", memoDate: "2026-01-10", directorApprovalDate: "2026-01-14", fpcSentDate: "2026-01-20", fpcApprovalDate: "2026-01-24", poAmountExcl: 623500000, poAmountIncl: 692085000, efficiency: 16500000, currency: "IDR", offers: [], documents: [] },
  { recordUid: "demo-002", requestId: "PROC-2026-0002", requestDate: "2026-03-12", status: "Ongoing", picName: "Robby", division: "Data & Analytics", position: "Product Owner", email: "robby@example.com", location: "Head Office", requestType: "Project", itemName: "Customer Analytics Platform", description: "Pengembangan platform analitik dan integrasi data.", quantity: 1, category: "Software", requestKind: "New", procurementMethod: "Pemilihan Langsung", budget: 2600000000, budgetCode: "IT-DNA-2026", selectedVendor: "", poNumber: "", poAmountExcl: 0, poAmountIncl: 0, efficiency: 0, currency: "IDR", offers: [], documents: [] },
  { recordUid: "demo-003", requestId: "PROC-2026-0003", requestDate: "2026-07-03", status: "Upcoming", picName: "Santo", division: "IT Operations", position: "Section Head", email: "santo@example.com", location: "Head Office", requestType: "Renewal", itemName: "Compliance Assessment 2026", description: "Assessment tahunan sistem kritikal.", quantity: 1, category: "Jasa", requestKind: "Renewal", procurementMethod: "Pemilihan Langsung", budget: 250000000, budgetCode: "IT-GRC-2026", selectedVendor: "", poNumber: "", poAmountExcl: 0, poAmountIncl: 0, efficiency: 0, currency: "IDR", offers: [], documents: [] },
]
const demoPics: ProcurementPic[] = [{ id: "demo-pic-1", name: "Danny Adi Saputra", division: "IT Strategy & GRC", position: "Department Head", email: "danny@example.com", location: "Head Office", active: true }, { id: "demo-pic-2", name: "Robby", division: "Data & Analytics", position: "Product Owner", email: "robby@example.com", location: "Head Office", active: true }, { id: "demo-pic-3", name: "Santo", division: "IT Operations", position: "Section Head", email: "santo@example.com", location: "Head Office", active: true }]
const initialWorkspace: ProcurementWorkspace = { version: 1, importedAt: "", sourceName: "Demo workspace", settings: defaultSettings, pics: demoPics, vendors: [], scorecards: [{ id: "starter-scorecard", projectName: "", requestId: "", scoringDate: "", evaluator: "", scheme: "normalized", technicalWeight: 70, commercialWeight: 30, technicalMaxScore: 100, commercialMaxScore: 100, includeApproval: false, vendors: [{ id: "starter-vendor-1", name: "", initialPrice: 0, finalPrice: 0, technicalScore: 0, notes: "" }, { id: "starter-vendor-2", name: "", initialPrice: 0, finalPrice: 0, technicalScore: 0, notes: "" }] }], records: demoRecords }

function initialWorkspaceState(): ProcurementWorkspace {
  if (typeof window === "undefined") return initialWorkspace
  try {
    const saved = window.localStorage.getItem("procurement-sheets-lab.settings")
    if (!saved) return initialWorkspace
    const settings = { ...initialWorkspace.settings, ...JSON.parse(saved) as Partial<ProcurementWorkspace["settings"]> }
    if (settings.autoRefreshSeconds && settings.autoRefreshSeconds < 120) settings.autoRefreshSeconds = 120
    return { ...initialWorkspace, settings }
  } catch { return initialWorkspace }
}

const emptyOffer = (): TenderOffer => ({ id: crypto.randomUUID(), vendor: "", initialOffer: 0, finalOffer: 0, taxRate: 0.11, technicalPass: true, winner: false })
const blankDraft = (): ProcurementRecord => ({ recordUid: crypto.randomUUID(), requestId: "", requestDate: new Date().toISOString().slice(0, 10), status: "Upcoming", picName: "", division: "", position: "", email: "", location: "Head Office", requestType: "Project", itemName: "", description: "", quantity: 1, category: "", requestKind: "", procurementMethod: "", budget: 0, budgetCode: "", selectedVendor: "", poNumber: "", poAmountExcl: 0, poAmountIncl: 0, efficiency: 0, currency: "IDR", offers: [], documents: [] })
const procurementTitle = (record: ProcurementRecord) => record.description || record.itemName || "Tanpa deskripsi"
const compactMoney = (value: number, currency = "IDR") => `${currency === "IDR" ? "Rp" : currency} ${compact.format(value)}`
const currencyBreakdown = (records: ProcurementRecord[], key: "poAmountIncl" | "efficiency") => {
  const totals = records.reduce<Record<string, number>>((result, record) => ({ ...result, [record.currency]: (result[record.currency] ?? 0) + record[key] }), {})
  return Object.entries(totals).filter(([, value]) => value).map(([currency, value]) => compactMoney(value, currency)).join(" · ") || "Rp 0"
}
const masterSortOptions: { value: MasterSortKey; label: string }[] = [
  { value: "requestDate", label: "Tanggal request" }, { value: "requestId", label: "Nomor Request" }, { value: "description", label: "Deskripsi" }, { value: "status", label: "Status" }, { value: "picName", label: "Requester" }, { value: "selectedVendor", label: "Vendor terpilih" }, { value: "poNumber", label: "Nomor PO" }, { value: "poDate", label: "Tanggal PO" }, { value: "poAmountIncl", label: "Nilai PO incl. PPN" }, { value: "efficiency", label: "Efisiensi" }, { value: "budget", label: "Budget" },
]

export default function ProcurementApp({ auth }: { auth: AuthenticatedProcurement }) {
  const [workspace, setWorkspace] = useState(initialWorkspaceState)
  const [view, setView] = useState<ProcurementView>("dashboard")
  const [year, setYear] = useState(currentYear)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [masterYearFilter, setMasterYearFilter] = useState("all")
  const [masterSortKey, setMasterSortKey] = useState<MasterSortKey>("requestDate")
  const [masterSortDirection, setMasterSortDirection] = useState<"asc" | "desc">("desc")
  const [masterPage, setMasterPage] = useState(1)
  const [masterPageSize, setMasterPageSize] = useState<number>(() => initialWorkspaceState().settings.defaultPageSize ?? 10)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [draft, setDraft] = useState<ProcurementRecord>(blankDraft)
  const [editMode, setEditMode] = useState<"create" | "edit">("create")
  const [pendingDelete, setPendingDelete] = useState<ProcurementRecord | null>(null)
  const [pendingBatchDelete, setPendingBatchDelete] = useState<ProcurementRecord[]>([])
  const [selectedRecords, setSelectedRecords] = useState<string[]>([])
  const [reportOpen, setReportOpen] = useState(false)
  const [driveToken, setDriveToken] = useState("")
  const [sheetConnection, setSheetConnection] = useState<SheetConnection>(null)
  const [operation, setOperation] = useState<OperationState>({ open: false, title: "", message: "", step: 0, total: 1, state: "working" })
  const [reviewCount, setReviewCount] = useState(0)
  const [datasets, setDatasets] = useState<ProcurementDataset[]>([])
  const [selectedDatasetKey, setSelectedDatasetKey] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)
  const autoWorkspaceAttempted = useRef(false)
  const workspaceRefreshInFlight = useRef(false)
  const backendWorkspace = useMemo(() => new AppsScriptWorkspaceAdapter(auth.repository), [auth.repository])

  useEffect(() => { window.localStorage.setItem("procurement-sheets-lab.settings", JSON.stringify(workspace.settings)) }, [workspace.settings])
  useEffect(() => {
    for (const key of ["large-text", "high-contrast", "reduce-motion"]) document.documentElement.classList.toggle(key, window.localStorage.getItem(`procurement-sheets-lab.${key}`) === "true")
  }, [])
  useEffect(() => {
    const refresh = () => Promise.all([auth.repository.listReviewQueue().then((items) => setReviewCount(items.length)), auth.repository.flushPendingStatusSyncs()]).catch(() => undefined)
    void refresh()
    const seconds = workspace.settings.autoRefreshSeconds ?? 30
    const timer = seconds ? window.setInterval(refresh, seconds * 1000) : undefined
    window.addEventListener("focus", refresh)
    return () => { if (timer) window.clearInterval(timer); window.removeEventListener("focus", refresh) }
  }, [auth.repository, workspace.settings.autoRefreshSeconds])
  useEffect(() => {
    if (autoWorkspaceAttempted.current) return
    autoWorkspaceAttempted.current = true
    // Deployment backend lama tetap dapat membuka dashboard selama versi baru belum dipublikasikan.
    void auth.repository.listProcurementDatasets().catch(() => [legacyDatasetFallback]).then(async (available) => {
      const preferred = available.find((item) => item.active) || available[0]
      if (!preferred) throw new Error("Dataset pengadaan tidak tersedia.")
      setDatasets(available); setSelectedDatasetKey(preferred.key)
      auth.repository.setProcurementDataset(preferred.key)
      const loaded = await backendWorkspace.loadWorkspace(workspace.settings, workspace.scorecards)
      setWorkspace((current) => ({ ...loaded, settings: current.settings }))
      setYear(preferred.year || currentYear)
      setSheetConnection({ spreadsheetId: "apps-script", title: `${loaded.sourceName} · ${preferred.label}`, lastSyncedAt: new Date().toISOString() })
    }).catch((error) => toast.error(error instanceof Error ? `Master pengadaan gagal dimuat: ${error.message}` : "Master pengadaan gagal dimuat."))
  }, [auth.repository, backendWorkspace, workspace.scorecards, workspace.settings])
  useEffect(() => {
    if (!sheetConnection) return
    const configuredSeconds = workspace.settings.autoRefreshSeconds ?? 120
    const seconds = configuredSeconds ? Math.max(configuredSeconds, 120) : 0
    if (!seconds) return
    const refresh = async () => {
      if (document.hidden || workspaceRefreshInFlight.current) return
      workspaceRefreshInFlight.current = true
      try {
        const latest = await backendWorkspace.loadWorkspace(workspace.settings, workspace.scorecards)
        setWorkspace((current) => ({ ...latest, settings: current.settings }))
        setSheetConnection((current) => current ? { ...current, lastSyncedAt: new Date().toISOString() } : current)
      } catch { /* Sinkron berikutnya akan mencoba kembali tanpa mengganggu layar aktif. */ }
      finally { workspaceRefreshInFlight.current = false }
    }
    const timer = window.setInterval(() => { void refresh() }, seconds * 1000)
    return () => window.clearInterval(timer)
  }, [backendWorkspace, sheetConnection, workspace.scorecards, workspace.settings])

  const showOperation = (title: string, message: string, total = 4) => setOperation({ open: true, title, message, step: 1, total, state: "working" })
  const updateOperation = (message: string) => setOperation((current) => ({ ...current, message, step: Math.min(current.total, current.step + 1) }))
  const finishOperation = (message: string) => setOperation((current) => ({ ...current, message, step: current.total, state: "success" }))
  const failOperation = (message: string) => setOperation((current) => ({ ...current, message, state: "error" }))
  const reloadWorkspace = async () => {
    const latest = await backendWorkspace.loadWorkspace(workspace.settings, workspace.scorecards)
    setWorkspace((current) => ({ ...latest, settings: current.settings }))
    setSheetConnection((current) => current ? { ...current, lastSyncedAt: new Date().toISOString() } : current)
  }

  async function selectDataset(datasetKey: string) {
    const target = datasets.find((item) => item.key === datasetKey)
    if (!target) return
    showOperation("Membuka dataset", `Memuat ${target.label}`, 2)
    try {
      auth.repository.setProcurementDataset(datasetKey)
      setSelectedDatasetKey(datasetKey)
      const latest = await backendWorkspace.loadWorkspace(workspace.settings, workspace.scorecards)
      setWorkspace((current) => ({ ...latest, settings: current.settings }))
      setYear(target.year || currentYear); setSelectedRecords([]); setMasterPage(1)
      setSheetConnection({ spreadsheetId: "apps-script", title: `${latest.sourceName} · ${target.label}`, lastSyncedAt: new Date().toISOString() })
      finishOperation(`${target.label} siap digunakan`)
    } catch (error) { failOperation(error instanceof Error ? error.message : "Dataset gagal dimuat.") }
  }
  async function prepareDataset(datasetYear: number) {
    showOperation("Menyiapkan dataset", `Membuat sandbox ${datasetYear}`, 3)
    try { const items = await auth.repository.prepareProcurementDataset(datasetYear); setDatasets(items); finishOperation(`Sandbox ${datasetYear} berhasil dibuat`) }
    catch (error) { failOperation(error instanceof Error ? error.message : "Dataset gagal dibuat.") }
  }
  async function activateDataset(datasetKey: string) {
    showOperation("Mengaktifkan dataset", "Memperbarui dataset aktif portal", 3)
    try { const items = await auth.repository.activateProcurementDataset(datasetKey); setDatasets(items); await selectDataset(datasetKey); toast.success("Dataset aktif berhasil diperbarui.") }
    catch (error) { failOperation(error instanceof Error ? error.message : "Dataset gagal diaktifkan.") }
  }
  async function archiveDataset(datasetKey: string) {
    showOperation("Mengarsipkan dataset", "Memperbarui registry dataset", 2)
    try { const items = await auth.repository.archiveProcurementDataset(datasetKey); setDatasets(items); finishOperation("Dataset berhasil diarsipkan") }
    catch (error) { failOperation(error instanceof Error ? error.message : "Dataset gagal diarsipkan.") }
  }
  async function resetSandbox(datasetKey: string, confirmation: string) {
    showOperation("Reset sandbox", "Membuat backup sebelum mengosongkan data", 4)
    try { const items = await auth.repository.resetProcurementSandbox(datasetKey, confirmation); setDatasets(items); if (datasetKey === selectedDatasetKey) await selectDataset(datasetKey); finishOperation("Sandbox sudah di-backup dan direset") }
    catch (error) { failOperation(error instanceof Error ? error.message : "Sandbox gagal direset.") }
  }

  async function googleToken() {
    if (driveToken) return driveToken
    const clientId = workspace.settings.driveClientId || auth.googleClientId
    if (!clientId) throw new Error("Google OAuth Client ID belum tersedia.")
    const token = await requestDriveToken(clientId)
    setDriveToken(token)
    return token
  }

  const years = useMemo(() => { const values = new Set(workspace.records.map((record) => Number(record.requestDate.slice(0, 4))).filter(Boolean)); values.add(datasets.find((item) => item.key === selectedDatasetKey)?.year || currentYear); return [...values].sort((a, b) => b - a) }, [datasets, selectedDatasetKey, workspace.records])
  const requestYearRecords = useMemo(() => workspace.records.filter((record) => Number(record.requestDate.slice(0, 4)) === year), [workspace.records, year])
  const statusData = STATUS_ORDER.map((status) => ({ status, value: requestYearRecords.filter((record) => record.status === status).length }))
  const monthlyData = Array.from({ length: 12 }, (_, index) => ({ month: new Intl.DateTimeFormat("id-ID", { month: "short" }).format(new Date(2026, index, 1)), total: requestYearRecords.filter((record) => Number(record.requestDate.slice(5, 7)) === index + 1).length }))
  const expenseDisplay = currencyBreakdown(requestYearRecords, "poAmountIncl")
  const efficiencyDisplay = currencyBreakdown(requestYearRecords, "efficiency")
  const categories = useMemo(() => [...new Set(["Software", "Hardware", "Jasa", "Subscription", "Maintenance", "Lisensi", "Infrastruktur", "Peripheral", ...workspace.records.map((record) => record.category)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")), [workspace.records])
  const filteredRecords = useMemo(() => workspace.records.filter((record) => [record.requestId, record.originalRequestId, record.itemName, record.description, record.picName, record.division, record.selectedVendor, record.poNumber, record.category, record.procurementMethod].join(" ").toLowerCase().includes(search.toLowerCase()) && (statusFilter === "all" || record.status === statusFilter) && (masterYearFilter === "all" || record.requestDate.slice(0, 4) === masterYearFilter)).sort((a, b) => {
    const left = masterSortKey === "description" ? procurementTitle(a) : a[masterSortKey] ?? ""
    const right = masterSortKey === "description" ? procurementTitle(b) : b[masterSortKey] ?? ""
    const result = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right), "id", { numeric: true, sensitivity: "base" })
    return masterSortDirection === "asc" ? result : -result
  }), [workspace.records, search, statusFilter, masterYearFilter, masterSortKey, masterSortDirection])
  const masterPageCount = Math.max(1, Math.ceil(filteredRecords.length / masterPageSize))
  const visibleMasterRecords = filteredRecords.slice((Math.min(masterPage, masterPageCount) - 1) * masterPageSize, Math.min(masterPage, masterPageCount) * masterPageSize)

  async function importFile(file?: File) {
    if (!file) return
    showOperation("Import workbook", "Membuka file Excel", 5)
    try {
      const imported = await new XlsxWorkspaceAdapter().import(file, workspace.settings, workspace.scorecards, updateOperation)
      setWorkspace(imported)
      const importedYears = imported.records.map((record) => Number(record.requestDate.slice(0, 4))).filter(Boolean)
      if (importedYears.length) setYear(Math.max(...importedYears))
      finishOperation(`${imported.records.length} pengadaan selesai dimuat`)
    } catch (error) { failOperation(error instanceof Error ? error.message : "Workbook gagal dibaca.") }
    finally { if (fileInput.current) fileInput.current.value = "" }
  }
  function updateDraft<K extends keyof ProcurementRecord>(key: K, value: ProcurementRecord[K]) { setDraft((current) => { const next = { ...current, [key]: value }; return key === "offers" || key === "procurementMethod" ? syncWinnerToPo(next, current.offers.some((offer) => offer.winner)) : next }) }
  function selectPic(pic: ProcurementPic) { setDraft((current) => ({ ...current, picName: pic.name, division: pic.division, position: pic.position, email: pic.email, location: pic.location })) }
  function changeOffer(index: number, patch: Partial<TenderOffer>) { updateDraft("offers", draft.offers.map((offer, offerIndex) => patch.winner && offerIndex !== index ? { ...offer, winner: false } : offerIndex === index ? { ...offer, ...patch } : offer)) }

  function openLatestRecordForEdit(record: ProcurementRecord) {
    // Snapshot sudah disinkronkan berkala; validasi baris terbaru tetap dilakukan backend saat Simpan.
    setDraft(structuredClone(record))
    setEditMode("edit")
    setDialogOpen(true)
  }

  async function saveDraft() {
    if (!draft.itemName || !draft.requestDate || !draft.picName || !draft.procurementMethod) { toast.error("Tanggal request, Requestor, nama, dan metode pengadaan wajib diisi."); return }
    const dateSequence = [
      ["Tanggal Request", draft.requestDate],
      ["Tanggal Memo", draft.memoDate],
      ["Tanggal Persetujuan Direksi", draft.directorApprovalDate],
      ["Tanggal Kirim FPC", draft.fpcSentDate],
      ["Tanggal Approval FPC", draft.fpcApprovalDate],
      ["Tanggal PO", draft.poDate],
    ].filter((entry): entry is [string, string] => Boolean(entry[1]))
    for (let index = 1; index < dateSequence.length; index++) {
      if (dateSequence[index][1] < dateSequence[index - 1][1]) {
        toast.error(`${dateSequence[index][0]} tidak boleh sebelum ${dateSequence[index - 1][0]}.`)
        return
      }
    }
    const vendorOffers = draft.procurementMethod === "Pemilihan Langsung" ? draft.offers : []
    const winner = vendorOffers.find((offer) => offer.winner)
    const poAmountExcl = winner?.finalOffer ?? draft.poAmountExcl
    const initialPriceExcl = winner?.initialOffer ?? draft.initialPriceExcl ?? 0
    const saved: ProcurementRecord = { ...draft, initialPriceExcl, offers: vendorOffers, documents: draft.documents.filter((document) => document.name || document.webViewLink), requestId: editMode === "edit" ? draft.requestId : "", selectedVendor: winner?.vendor ?? draft.selectedVendor, poAmountExcl, poAmountIncl: poAmountExcl * 1.11, efficiency: Math.max(0, initialPriceExcl - poAmountExcl) * 1.11 }
    showOperation(editMode === "edit" ? "Memperbarui pengadaan" : "Menambah pengadaan", "Menulis langsung ke master spreadsheet", 3)
    try {
      const persisted = await backendWorkspace.upsertProcurement(saved, editMode)
      setWorkspace((current) => ({ ...current, records: editMode === "edit" ? current.records.map((record) => record.recordUid === persisted.recordUid ? persisted : record) : [...current.records, persisted] }))
      const portalId = persisted.originalRequestId || persisted.requestId
      if (portalId.startsWith("NPR-")) {
        const poUrl = persisted.documents.find((document) => document.type.toUpperCase() === "PO")?.webViewLink || ""
        try { await auth.repository.syncProcurementStatus(portalId, persisted.status, persisted.poNumber, poUrl) } catch { toast.warning("Master tersimpan, sinkron status portal akan dicoba ulang.") }
      }
      finishOperation("MASTER DATABASE PENGADAAN sudah diperbarui")
      setDialogOpen(false); setDraft(blankDraft()); setEditMode("create")
      toast.success(`${persisted.requestId} berhasil disimpan.`)
    } catch (error) { failOperation(error instanceof Error ? error.message : "Perubahan gagal disimpan.") }
  }

  async function deleteRecord() {
    if (!pendingDelete) return
    const target = pendingDelete; setPendingDelete(null)
    showOperation("Menghapus pengadaan", `Menghapus ${target.requestId} dari sheet utama`, 3)
    try { await backendWorkspace.deleteProcurement(target); await reloadWorkspace(); setSelectedRecords((current) => current.filter((id) => id !== target.recordUid)); finishOperation(`${target.requestId} berhasil dihapus`) } catch (error) { failOperation(error instanceof Error ? error.message : "Pengadaan gagal dihapus.") }
  }
  async function deleteRecords(records: ProcurementRecord[]) {
    if (!records.length) return
    setPendingBatchDelete([]); showOperation("Menghapus pengadaan", `Menghapus ${records.length} baris dari sheet utama`, 3)
    try { await backendWorkspace.deleteProcurements(records); await reloadWorkspace(); setSelectedRecords([]); finishOperation(`${records.length} pengadaan berhasil dihapus`) } catch (error) { failOperation(error instanceof Error ? error.message : "Batch delete gagal.") }
  }
  async function savePic(pic: ProcurementPic) { showOperation("Menyimpan requester", `Menulis ${pic.name} ke MASTER PIC`, 3); try { await backendWorkspace.upsertPic(pic); await reloadWorkspace(); finishOperation(`${pic.name} tersimpan di MASTER PIC`) } catch (error) { failOperation(error instanceof Error ? error.message : "Requester gagal disimpan.") } }
  async function deletePic(pic: ProcurementPic) { showOperation("Menghapus requester", `Menghapus ${pic.name} dari MASTER PIC`, 3); try { await backendWorkspace.deletePic(pic); await reloadWorkspace(); finishOperation(`${pic.name} sudah dihapus`) } catch (error) { failOperation(error instanceof Error ? error.message : "Requester gagal dihapus.") } }
  async function deletePics(pics: ProcurementPic[]) { showOperation("Menghapus requester", `Menghapus ${pics.length} requester dari MASTER PIC`, 3); try { await backendWorkspace.deletePics(pics); await reloadWorkspace(); finishOperation(`${pics.length} requester sudah dihapus`) } catch (error) { failOperation(error instanceof Error ? error.message : "Batch delete requester gagal.") } }
  async function saveVendor(vendor: ProcurementVendor) { showOperation("Menyimpan vendor", `Menulis ${vendor.name} ke VENDOR REKANAN`, 3); try { await backendWorkspace.upsertVendor(vendor); await reloadWorkspace(); finishOperation(`${vendor.name} tersimpan di VENDOR REKANAN`) } catch (error) { failOperation(error instanceof Error ? error.message : "Vendor gagal disimpan.") } }
  async function deleteVendor(vendor: ProcurementVendor) { showOperation("Menghapus vendor", `Menghapus ${vendor.name} dari VENDOR REKANAN`, 3); try { await backendWorkspace.deleteVendor(vendor); await reloadWorkspace(); finishOperation(`${vendor.name} sudah dihapus`) } catch (error) { failOperation(error instanceof Error ? error.message : "Vendor gagal dihapus.") } }
  async function deleteVendors(vendors: ProcurementVendor[]) { showOperation("Menghapus vendor", `Menghapus ${vendors.length} vendor dari VENDOR REKANAN`, 3); try { await backendWorkspace.deleteVendors(vendors); await reloadWorkspace(); finishOperation(`${vendors.length} vendor sudah dihapus`) } catch (error) { failOperation(error instanceof Error ? error.message : "Batch delete vendor gagal.") } }

  const navItems: ProcurementNavItem[] = [{ id: "dashboard", label: "Dashboard", icon: LayoutDashboard }, { id: "review", label: "Document Review", icon: FileCheck2, badge: reviewCount }, { id: "master", label: "Master Pengadaan", icon: FileArchive }, { id: "pics", label: "Requester", icon: ContactRound }, { id: "vendors", label: "Vendor", icon: Store }, { id: "vendor_management", label: "Vendor Management", icon: Building2 }, { id: "tender", label: "Scoring Pemilihan Langsung", icon: Users }, { id: "documents", label: "Dokumen", icon: FolderOpen }, { id: "settings", label: "Pengaturan", icon: Settings }]

  return <SidebarProvider>
    <ProcurementSidebar view={view} setView={setView} navItems={navItems} auth={auth} />
    <SidebarInset className="min-w-0 bg-[#f4f8fc]"><header className="sticky top-0 z-20 flex h-17 items-center justify-between border-b border-blue-100 bg-white/92 px-4 backdrop-blur-xl md:px-7"><div className="flex min-w-0 items-center gap-3"><SidebarTrigger className="text-[#082f63]" /><div className="min-w-0"><h1 className="truncate font-display text-lg font-bold text-[#082f63] md:text-xl">{navItems.find((item) => item.id === view)?.label}</h1><p className="truncate text-xs text-slate-500">{workspace.sourceName} · {workspace.records.length} record · Apps Script live</p></div></div><NotificationCenter records={workspace.records} onOpenRecord={(record) => { setSearch(record.requestId); setMasterYearFilter("all"); setStatusFilter("all"); setView("master") }} /></header>
      <main className="min-w-0 p-4 md:p-7">
        {view === "dashboard" && <ProcurementDashboard year={year} years={years} setYear={setYear} requestRecords={requestYearRecords} statusData={statusData} monthlyData={monthlyData} expenseDisplay={expenseDisplay} efficiencyDisplay={efficiencyDisplay} goMaster={() => setView("master")} openReport={() => setReportOpen(true)} />}
        {view === "review" && <DocumentReview repository={auth.repository} onQueueChange={setReviewCount} />}
        {view === "master" && <div className="mx-auto max-w-[1600px] space-y-5"><section className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 xl:grid-cols-[minmax(260px,1fr)_170px_170px_230px_150px_auto]"><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setMasterPage(1) }} placeholder="Cari semua data pengadaan..." className="border-slate-200 pl-9" /></div><Select value={masterYearFilter} onValueChange={(value) => { setMasterYearFilter(value); setMasterPage(1) }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua tahun</SelectItem>{years.map((value) => <SelectItem value={String(value)} key={value}>Tahun {value}</SelectItem>)}</SelectContent></Select><Select value={statusFilter} onValueChange={(value) => { setStatusFilter(value); setMasterPage(1) }}><SelectTrigger className="w-full"><ListFilter /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem>{STATUS_ORDER.map((status) => <SelectItem value={status} key={status}>{status}</SelectItem>)}</SelectContent></Select><Select value={masterSortKey} onValueChange={(value) => setMasterSortKey(value as MasterSortKey)}><SelectTrigger className="w-full"><ArrowDownUp /><SelectValue /></SelectTrigger><SelectContent>{masterSortOptions.map((option) => <SelectItem value={option.value} key={option.value}>Urut: {option.label}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => setMasterSortDirection((current) => current === "asc" ? "desc" : "asc")}><ArrowDownUp />{masterSortDirection === "asc" ? "Naik / A–Z" : "Turun / Z–A"}</Button><Button variant="outline" className="text-rose-600" disabled={!selectedRecords.length} onClick={() => setPendingBatchDelete(workspace.records.filter((record) => selectedRecords.includes(record.recordUid)))}><Trash2 /> Hapus {selectedRecords.length || "batch"}</Button></section><div className="flex justify-end"><Button className="bg-[#082f63] text-white hover:bg-[#174a7d]" onClick={() => { setDraft(blankDraft()); setEditMode("create"); setDialogOpen(true) }}><Plus /> Tambah Pengadaan</Button></div><div className="flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500"><span>Menampilkan <strong className="text-slate-800">{visibleMasterRecords.length}</strong> dari {filteredRecords.length} record.</span><div className="flex items-center gap-2"><Select value={String(masterPageSize)} onValueChange={(value) => { const size = Number(value) as 10 | 25 | 50 | 100; setMasterPageSize(size); setMasterPage(1); setWorkspace((current) => ({ ...current, settings: { ...current.settings, defaultPageSize: size } })) }}><SelectTrigger className="w-24 bg-white"><SelectValue /></SelectTrigger><SelectContent>{[10, 25, 50, 100].map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent></Select><Button variant="outline" size="sm" disabled={masterPage <= 1} onClick={() => setMasterPage((value) => value - 1)}>Sebelumnya</Button><span>{Math.min(masterPage, masterPageCount)}/{masterPageCount}</span><Button variant="outline" size="sm" disabled={masterPage >= masterPageCount} onClick={() => setMasterPage((value) => value + 1)}>Berikutnya</Button></div></div><div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><ProcurementTable records={visibleMasterRecords} extended onEdit={(record) => { void openLatestRecordForEdit(record) }} onDelete={setPendingDelete} selected={selectedRecords} setSelected={setSelectedRecords} /></div></div>}
        {view === "pics" && <PicMasterView pics={workspace.pics} onSave={savePic} onDelete={deletePic} onDeleteMany={deletePics} />}
        {view === "vendors" && <VendorMasterView vendors={workspace.vendors} onSave={saveVendor} onDelete={deleteVendor} onDeleteMany={deleteVendors} />}
        {view === "vendor_management" && <VendorManagement vendors={workspace.vendors} records={workspace.records} />}
        {view === "tender" && <TenderScoring scorecards={workspace.scorecards} onChange={(scorecards) => setWorkspace((current) => ({ ...current, scorecards }))} />}
        {view === "documents" && <DriveBrowser token={driveToken} connectDrive={async () => { await googleToken().then(() => toast.success("Google Drive terhubung.")).catch((error) => toast.error(error instanceof Error ? error.message : "Google Drive gagal dihubungkan.")) }} />}
        {view === "settings" && <><input ref={fileInput} type="file" accept=".xlsx,.xls" className="hidden" onChange={(event) => importFile(event.target.files?.[0])} /><ProcurementSettings workspace={workspace} setWorkspace={setWorkspace} sheetConnection={sheetConnection} pageSize={masterPageSize} setPageSize={(size) => { setMasterPageSize(size); setMasterPage(1) }} exportXlsx={() => { downloadBlob(new XlsxWorkspaceAdapter().export(workspace), `Master_Pengadaan_${new Date().toISOString().slice(0, 10)}.xlsx`); toast.success("Master spreadsheet berhasil dibuat.") }} exportJson={() => downloadBlob(new Blob([JSON.stringify(workspace, null, 2)], { type: "application/json" }), `Procurement_Workspace_${new Date().toISOString().slice(0, 10)}.json`)} openReport={() => setReportOpen(true)} importXlsx={() => fileInput.current?.click()} datasets={datasets} selectedDatasetKey={selectedDatasetKey} onSelectDataset={selectDataset} onPrepareDataset={prepareDataset} onActivateDataset={activateDataset} onArchiveDataset={archiveDataset} onResetSandbox={resetSandbox} /></>}
      </main>
    </SidebarInset>
    <AddProcurementDialog open={dialogOpen} setOpen={setDialogOpen} draft={draft} pics={workspace.pics} vendors={workspace.vendors} categories={categories} updateDraft={updateDraft} selectPic={selectPic} changeOffer={changeOffer} save={saveDraft} emptyOffer={emptyOffer} mode={editMode} />
    <ReportExportDialog open={reportOpen} setOpen={setReportOpen} records={workspace.records} />
    <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus pengadaan ini?</AlertDialogTitle><AlertDialogDescription><strong className="break-all text-slate-900">{pendingDelete?.requestId}</strong> beserta relasi penawaran dan dokumennya akan dihapus dari master database.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={deleteRecord}>Hapus Pengadaan</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(pendingBatchDelete.length)} onOpenChange={(open) => { if (!open) setPendingBatchDelete([]) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus {pendingBatchDelete.length} pengadaan?</AlertDialogTitle><AlertDialogDescription>Semua baris terpilih dan relasi penawarannya akan dihapus langsung dari master database.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction className="bg-rose-600 hover:bg-rose-700" onClick={() => void deleteRecords(pendingBatchDelete)}>Hapus Semua</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <OperationDialog operation={operation} close={() => setOperation((current) => ({ ...current, open: false }))} />
    <Toaster richColors position="top-right" />
  </SidebarProvider>
}
