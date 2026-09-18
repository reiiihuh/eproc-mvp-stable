"use client"

import { useEffect, useState } from "react"
import { Archive, CalendarRange, Database, Eye, FileSpreadsheet, Link2, RotateCcw, SlidersHorizontal, Upload } from "lucide-react"

import type { SheetConnection } from "@/components/procurement/procurement-ui-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { ProcurementDataset, ProcurementWorkspace, WorkspaceSettings } from "@/lib/procurement-types"

type SettingsProps = {
  workspace: ProcurementWorkspace; setWorkspace: React.Dispatch<React.SetStateAction<ProcurementWorkspace>>
  sheetConnection: SheetConnection; pageSize: number; setPageSize: (size: number) => void
  exportXlsx: () => void; exportJson: () => void; openReport: () => void; importXlsx: () => void
  datasets: ProcurementDataset[]; selectedDatasetKey: string
  onSelectDataset: (key: string) => Promise<void>; onPrepareDataset: (year: number) => Promise<void>
  onActivateDataset: (key: string) => Promise<void>; onArchiveDataset: (key: string) => Promise<void>
  onResetSandbox: (key: string, confirmation: string) => Promise<void>
}

export function ProcurementSettings(props: SettingsProps) {
  const { workspace, setWorkspace, sheetConnection, pageSize, setPageSize, exportXlsx, exportJson, openReport, importXlsx, datasets, selectedDatasetKey, onSelectDataset, onPrepareDataset, onActivateDataset, onArchiveDataset, onResetSandbox } = props
  const [newYear, setNewYear] = useState(new Date().getFullYear() + 1)
  const [confirmation, setConfirmation] = useState("")
  const selected = datasets.find((item) => item.key === selectedDatasetKey)
  const updateSetting = <K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) => setWorkspace((current) => ({ ...current, settings: { ...current.settings, [key]: value } }))
  return <div className="mx-auto grid max-w-5xl gap-5 lg:grid-cols-2">
    <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 font-display text-lg"><SlidersHorizontal className="text-[#2075b8]" />Pengaturan Umum</CardTitle><CardDescription>Preferensi tampilan aplikasi tersimpan pada browser ini.</CardDescription></CardHeader><CardContent className="grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-medium">Baris tabel default<Select value={String(pageSize)} onValueChange={(value) => { const size = Number(value) as 10 | 25 | 50 | 100; setPageSize(size); updateSetting("defaultPageSize", size) }}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{[10, 25, 50, 100].map((size) => <SelectItem key={size} value={String(size)}>{size} baris</SelectItem>)}</SelectContent></Select></label><label className="space-y-2 text-sm font-medium">Refresh data otomatis<Select value={String(workspace.settings.autoRefreshSeconds ?? 120)} onValueChange={(value) => updateSetting("autoRefreshSeconds", Number(value) as WorkspaceSettings["autoRefreshSeconds"])}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="0">Nonaktif</SelectItem><SelectItem value="120">2 menit</SelectItem></SelectContent></Select></label></CardContent></Card>
    <Card className="border-emerald-200 bg-gradient-to-br from-white to-emerald-50/60 shadow-sm"><CardHeader><CardTitle className="flex items-center gap-2 font-display text-lg"><Link2 className="text-emerald-600" />Master Database</CardTitle><CardDescription>Pengadaan, requester, dan vendor tersinkron otomatis melalui Apps Script.</CardDescription></CardHeader><CardContent>{sheetConnection ? <div className="rounded-xl border border-emerald-200 bg-white p-4 text-sm"><p className="break-words font-semibold text-emerald-800">Terhubung · {sheetConnection.title}</p><p className="mt-1 text-slate-500">Sinkron terakhir {new Date(sheetConnection.lastSyncedAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}.</p></div> : <p className="text-sm text-slate-500">Menghubungkan backend…</p>}</CardContent></Card>
    <Card className="border-blue-200 shadow-sm lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2 font-display text-lg"><CalendarRange className="text-[#2075b8]" />Dataset Tahunan</CardTitle><CardDescription>Data lama tetap menjadi fallback. Dataset baru dibuat kosong sebagai sandbox dan baru dipakai portal setelah diaktifkan.</CardDescription></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-3 md:grid-cols-[minmax(220px,1fr)_auto_auto]"><Select value={selectedDatasetKey} onValueChange={(value) => void onSelectDataset(value)}><SelectTrigger className="w-full"><SelectValue placeholder="Pilih dataset" /></SelectTrigger><SelectContent>{datasets.map((item) => <SelectItem key={item.key} value={item.key}>{item.label} · {item.environment} · {item.status}</SelectItem>)}</SelectContent></Select><Button disabled={!selected || selected.active} onClick={() => selected && void onActivateDataset(selected.key)}>Aktifkan</Button><Button variant="outline" disabled={!selected || selected.active || selected.legacy || selected.status === "ARCHIVED"} onClick={() => selected && void onArchiveDataset(selected.key)}><Archive /> Arsipkan</Button></div>
      <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[160px_auto_1fr]"><Input type="number" min={2020} max={2100} value={newYear} onChange={(event) => setNewYear(Number(event.target.value))} /><Button variant="outline" onClick={() => void onPrepareDataset(newYear)}>Siapkan sandbox</Button><p className="self-center text-xs leading-5 text-slate-500">Membuat sheet transaksi tahunan tanpa menyalin isi master lama.</p></div>
      {selected && !selected.legacy && !selected.active && <div className="grid gap-3 rounded-xl border border-rose-200 bg-rose-50/60 p-4 md:grid-cols-[minmax(220px,1fr)_auto]"><div><p className="text-sm font-semibold text-rose-800">Backup dan reset dataset</p><p className="mb-2 text-xs text-rose-600">Ketik <strong>RESET {selected.key}</strong>. Seluruh transaksi dikosongkan setelah ketiga sheet berhasil di-backup.</p><Input value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={`RESET ${selected.key}`} /></div><Button className="self-end bg-rose-600 text-white hover:bg-rose-700" disabled={confirmation !== `RESET ${selected.key}`} onClick={() => { void onResetSandbox(selected.key, confirmation); setConfirmation("") }}><RotateCcw /> Backup & reset</Button></div>}
    </CardContent></Card>
    <Card className="border-slate-200 shadow-sm lg:col-span-2"><CardHeader><CardTitle className="font-display text-lg">Import, export & portability</CardTitle><CardDescription>Kelola sumber data dan keluaran workspace dari satu tempat.</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-3"><Button variant="outline" onClick={importXlsx}><Upload /> Import XLSX</Button><Button onClick={openReport}><FileSpreadsheet /> Buat laporan PDF/DOCX/XLSX</Button><Button variant="outline" onClick={exportXlsx}><FileSpreadsheet /> Export master XLSX</Button><Button variant="outline" onClick={exportJson}><Database /> Backup workspace JSON</Button></CardContent></Card>
    <AccessibilitySettings />
  </div>
}

function AccessibilitySettings() {
  const [largeText, setLargeText] = useState(() => typeof window !== "undefined" && localStorage.getItem("procurement-sheets-lab.large-text") === "true")
  const [highContrast, setHighContrast] = useState(() => typeof window !== "undefined" && localStorage.getItem("procurement-sheets-lab.high-contrast") === "true")
  const [reduceMotion, setReduceMotion] = useState(() => typeof window !== "undefined" && localStorage.getItem("procurement-sheets-lab.reduce-motion") === "true")
  useEffect(() => { document.documentElement.classList.toggle("large-text", largeText); localStorage.setItem("procurement-sheets-lab.large-text", String(largeText)) }, [largeText])
  useEffect(() => { document.documentElement.classList.toggle("high-contrast", highContrast); localStorage.setItem("procurement-sheets-lab.high-contrast", String(highContrast)) }, [highContrast])
  useEffect(() => { document.documentElement.classList.toggle("reduce-motion", reduceMotion); localStorage.setItem("procurement-sheets-lab.reduce-motion", String(reduceMotion)) }, [reduceMotion])
  const options = [{ label: "Teks lebih besar", detail: "Perbesar seluruh tampilan tanpa zoom browser.", value: largeText, set: setLargeText }, { label: "Kontras tinggi", detail: "Pertegas teks, border, dan fokus kontrol.", value: highContrast, set: setHighContrast }, { label: "Kurangi animasi", detail: "Matikan transisi dan animasi yang tidak diperlukan.", value: reduceMotion, set: setReduceMotion }]
  return <Card className="border-slate-200 shadow-sm lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2 font-display text-lg"><Eye className="text-[#2075b8]" />Accessibility</CardTitle><CardDescription>Pengaturan tersimpan di browser ini.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-3">{options.map((option) => <label key={option.label} className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4"><span><strong className="text-sm text-slate-900">{option.label}</strong><span className="mt-1 block text-xs leading-5 text-slate-500">{option.detail}</span></span><Switch checked={option.value} onCheckedChange={option.set} /></label>)}</CardContent></Card>
}
