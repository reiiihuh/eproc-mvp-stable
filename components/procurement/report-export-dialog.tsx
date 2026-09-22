"use client"
import { useMemo, useState } from "react"
import { Download, FileText } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DateInput } from "@/components/ui/date-input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { downloadBlob } from "@/lib/browser-download"
import { createProcurementReport, filterReportRecords, type ReportFormat, type ReportPeriod } from "@/lib/report-export"
import type { ProcurementRecord } from "@/lib/procurement-types"

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <div className="space-y-2"><Label>{label}</Label>{children}</div>

export function ReportExportDialog({ open, setOpen, records }: { open: boolean; setOpen: (open: boolean) => void; records: ProcurementRecord[] }) {
  const [period, setPeriod] = useState<ReportPeriod>("monthly")
  const [format, setFormat] = useState<ReportFormat | "all">("all")
  const [anchor, setAnchor] = useState(new Date().toISOString().slice(0, 10))
  const [customStart, setCustomStart] = useState("")
  const [customEnd, setCustomEnd] = useState("")
  const filtered = useMemo(() => filterReportRecords(records, period, anchor, customStart, customEnd), [anchor, customEnd, customStart, period, records])

  async function exportReport() {
    if (period === "custom" && (!customStart || !customEnd)) { toast.error("Isi tanggal awal dan akhir laporan."); return }
    // Semua file memakai model dan periode yang sama agar angka laporan konsisten.
    const formats: ReportFormat[] = format === "all" ? ["pdf", "docx", "xlsx"] : [format]
    for (const target of formats) { const result = await createProcurementReport(filtered.records, filtered.label, target); downloadBlob(result.blob, result.filename) }
    toast.success(`${filtered.records.length} pengadaan diekspor ke ${formats.map((item) => item.toUpperCase()).join(", ")}.`)
    setOpen(false)
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle className="flex items-center gap-2 font-display"><FileText className="text-[#2075b8]" />Export laporan pengadaan</DialogTitle><DialogDescription>Laporan manajemen memuat ringkasan, saving, status, dan detail transaksi.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 sm:grid-cols-2">
    <Field label="Periode"><Select value={period} onValueChange={(value) => setPeriod(value as ReportPeriod)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="daily">Harian</SelectItem><SelectItem value="weekly">Mingguan</SelectItem><SelectItem value="monthly">Bulanan</SelectItem><SelectItem value="quarterly">Triwulanan</SelectItem><SelectItem value="annual">Tahunan</SelectItem><SelectItem value="custom">Rentang custom</SelectItem></SelectContent></Select></Field>
    <Field label="Format"><Select value={format} onValueChange={(value) => setFormat(value as ReportFormat | "all")}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua · PDF + DOCX + XLSX</SelectItem><SelectItem value="pdf">PDF · Siap cetak</SelectItem><SelectItem value="docx">DOCX · Bisa diedit</SelectItem><SelectItem value="xlsx">XLSX · Data & ringkasan</SelectItem></SelectContent></Select></Field>
    {period === "custom" ? <><Field label="Tanggal awal"><DateInput aria-label="Tanggal awal" value={customStart} onChange={(value) => setCustomStart(value)} /></Field><Field label="Tanggal akhir"><DateInput aria-label="Tanggal akhir" value={customEnd} onChange={(value) => setCustomEnd(value)} /></Field></> : <Field label="Tanggal acuan"><DateInput aria-label="Tanggal acuan" value={anchor} onChange={(value) => setAnchor(value)} /></Field>}
    <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-4 sm:col-span-2"><p className="text-sm font-semibold text-[#082f63]">{filtered.label}</p><p className="mt-1 text-sm text-slate-600">{filtered.records.length} pengadaan akan masuk laporan.</p></div>
  </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button className="bg-[#082f63]" onClick={exportReport}><Download />Export {format === "all" ? "Semua" : format.toUpperCase()}</Button></DialogFooter></DialogContent></Dialog>
}
