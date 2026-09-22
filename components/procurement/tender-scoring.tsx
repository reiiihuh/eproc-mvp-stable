"use client"

import { useMemo, useState } from "react"
import { Calculator, FileDown, FileSpreadsheet, FileText, Plus, RotateCcw, Scale, Trash2, Trophy } from "lucide-react"
import { toast } from "sonner"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { DateInput } from "@/components/ui/date-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { downloadBlob } from "@/lib/browser-download"
import { calculateScorecard, exportScorecardDocx, exportScorecardPdf, exportScorecardXlsx, scorecardFormulaDescription, scoringScales } from "@/lib/tender-scoring"
import type { ScoringScheme, ScoringVendor, TenderScorecard } from "@/lib/procurement-types"

const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })

export function blankScoringVendor(): ScoringVendor {
  return { id: crypto.randomUUID(), name: "", initialPrice: 0, finalPrice: 0, technicalScore: 0, notes: "" }
}

export function blankScorecard(): TenderScorecard {
  return {
    id: crypto.randomUUID(),
    projectName: "",
    requestId: "",
    scoringDate: new Date().toISOString().slice(0, 10),
    evaluator: "",
    scheme: "normalized",
    technicalWeight: 70,
    commercialWeight: 30,
    technicalMaxScore: 100,
    commercialMaxScore: 100,
    includeApproval: false,
    vendors: [blankScoringVendor(), blankScoringVendor()],
  }
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}><Label>{label}</Label>{children}</div>
}

export function TenderScoring({ scorecards, onChange }: { scorecards: TenderScorecard[]; onChange: (scorecards: TenderScorecard[]) => void }) {
  const [activeId, setActiveId] = useState(scorecards[0]?.id ?? "")
  const [selectedScorecards, setSelectedScorecards] = useState<string[]>([])
  const [batchDeleteOpen, setBatchDeleteOpen] = useState(false)
  const active = scorecards.find((scorecard) => scorecard.id === activeId) ?? scorecards[0]
  const calculation = useMemo(() => active ? calculateScorecard(active) : null, [active])
  const formulas = useMemo(() => active ? scorecardFormulaDescription(active) : null, [active])
  const weightValid = active ? active.technicalWeight + active.commercialWeight === 100 : false
  const completeVendors = active?.vendors.filter((vendor) => vendor.name && vendor.finalPrice > 0) ?? []

  function createScorecard() {
    const next = blankScorecard()
    onChange([...scorecards, next])
    setActiveId(next.id)
  }

  function updateScorecard(patch: Partial<TenderScorecard>) {
    if (!active) return
    onChange(scorecards.map((scorecard) => scorecard.id === active.id ? { ...scorecard, ...patch } : scorecard))
  }

  function updateVendor(id: string, patch: Partial<ScoringVendor>) {
    if (!active) return
    updateScorecard({ vendors: active.vendors.map((vendor) => vendor.id === id ? { ...vendor, ...patch } : vendor) })
  }

  function deleteScorecard() {
    if (!active) return
    const remaining = scorecards.filter((scorecard) => scorecard.id !== active.id)
    if (!remaining.length) {
      const replacement = blankScorecard()
      onChange([replacement])
      setActiveId(replacement.id)
    } else {
      onChange(remaining)
      setActiveId(remaining[0].id)
    }
  }

  function deleteSelectedScorecards() {
    const remaining = scorecards.filter((scorecard) => !selectedScorecards.includes(scorecard.id))
    const next = remaining.length ? remaining : [blankScorecard()]
    onChange(next)
    setActiveId(next[0].id)
    setSelectedScorecards([])
    setBatchDeleteOpen(false)
  }

  function validateExport() {
    if (!active?.projectName.trim()) { toast.error("Isi nama project tender terlebih dahulu."); return false }
    if (!weightValid) { toast.error("Total bobot teknis dan komersial harus 100%."); return false }
    if (completeVendors.length < 2) { toast.error("Isi minimal dua vendor beserta harga finalnya."); return false }
    return true
  }

  if (!active || !calculation || !formulas) return null
  const scales = scoringScales(active)

  return <div className="mx-auto max-w-[1600px] space-y-5">
    <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm xl:flex-row xl:items-center xl:justify-between">
      <div><div className="flex items-center gap-2 text-sm font-semibold text-[#082f63]"><Calculator className="size-4 text-[#73d94b]" /> Scoring workspace</div><p className="mt-1 text-sm text-slate-500">Perhitungan berubah langsung saat harga, nilai teknis, skala, atau bobot diperbarui.</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Select value={active.id} onValueChange={setActiveId}><SelectTrigger className="w-64"><SelectValue /></SelectTrigger><SelectContent>{scorecards.map((scorecard, index) => <SelectItem value={scorecard.id} key={scorecard.id}>{scorecard.projectName || `Scoring baru ${index + 1}`}</SelectItem>)}</SelectContent></Select>
        <Button variant="outline" onClick={createScorecard}><Plus /> Scoring baru</Button>
        <Button variant="ghost" size="icon" aria-label="Hapus scoring" onClick={deleteScorecard}><Trash2 /></Button>
      </div>
    </section>
    <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between"><div className="flex flex-wrap gap-2">{scorecards.map((scorecard, index) => <label key={scorecard.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm"><Checkbox checked={selectedScorecards.includes(scorecard.id)} onCheckedChange={(checked) => setSelectedScorecards(checked === true ? [...selectedScorecards, scorecard.id] : selectedScorecards.filter((id) => id !== scorecard.id))} />{scorecard.projectName || `Scoring ${index + 1}`}</label>)}</div><Button variant="outline" className="shrink-0 text-rose-600" disabled={!selectedScorecards.length} onClick={() => setBatchDeleteOpen(true)}><Trash2 /> Hapus {selectedScorecards.length || "batch"}</Button></section>

    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100"><CardTitle className="font-display text-lg">Identitas & metode penilaian</CardTitle><CardDescription>Parameter ini akan tercantum di PDF dan spreadsheet untuk kebutuhan audit.</CardDescription></CardHeader>
      <CardContent className="grid gap-4 pt-5 md:grid-cols-2 xl:grid-cols-4">
        <Field label="Nama project tender *" className="md:col-span-2"><Input value={active.projectName} onChange={(event) => updateScorecard({ projectName: event.target.value })} placeholder="Contoh: Annual Penetration Testing 2026" /></Field>
        <Field label="Tanggal scoring"><DateInput aria-label="Tanggal scoring" value={active.scoringDate} onChange={(value) => updateScorecard({ scoringDate: value })} /></Field>
        <Field label="Skema nilai"><Select value={active.scheme} onValueChange={(scheme) => updateScorecard({ scheme: scheme as ScoringScheme })}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="normalized">Semua nilai skala 100</SelectItem><SelectItem value="weighted">Nilai sudah berbobot</SelectItem><SelectItem value="custom">Skala khusus</SelectItem></SelectContent></Select></Field>
        <div className="grid grid-cols-2 gap-3"><Field label="Bobot teknis"><Input type="number" min="0" max="100" value={active.technicalWeight} onChange={(event) => updateScorecard({ technicalWeight: Number(event.target.value) })} /></Field><Field label="Bobot komersial"><Input type="number" min="0" max="100" value={active.commercialWeight} onChange={(event) => updateScorecard({ commercialWeight: Number(event.target.value) })} /></Field></div>
        {active.scheme === "custom" && <><Field label="Skala teknis maks."><Input type="number" min="1" value={active.technicalMaxScore} onChange={(event) => updateScorecard({ technicalMaxScore: Number(event.target.value) })} /></Field><Field label="Skala komersial maks."><Input type="number" min="1" value={active.commercialMaxScore} onChange={(event) => updateScorecard({ commercialMaxScore: Number(event.target.value) })} /></Field></>}
        <div className={`rounded-xl border p-4 text-sm md:col-span-2 xl:col-span-4 ${weightValid ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}><div className="flex flex-wrap items-center justify-between gap-2"><strong>{weightValid ? "Parameter valid" : "Total bobot harus 100%"}</strong><span>Skala aktif: teknis {scales.technicalMax} · komersial {scales.commercialMax}</span></div><p className="mt-2 text-xs leading-5">Komersial: {formulas.commercial}<br />Final: {formulas.final}</p></div>
      </CardContent>
    </Card>

    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="flex-row items-center justify-between border-b border-slate-100"><div><CardTitle className="font-display text-lg">Vendor & penawaran</CardTitle><CardDescription>Minimal dua vendor. Harga terendah dideteksi otomatis.</CardDescription></div><Button variant="outline" onClick={() => updateScorecard({ vendors: [...active.vendors, blankScoringVendor()] })}><Plus /> Vendor</Button></CardHeader>
      <CardContent className="space-y-3 pt-5">
        {active.vendors.map((vendor, index) => <div key={vendor.id} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-4 xl:grid-cols-[50px_1.1fr_1fr_1fr_.75fr_1.5fr_auto]">
          <div className="grid size-10 place-items-center self-end rounded-lg bg-slate-200 text-sm font-bold text-slate-600">{index + 1}</div>
          <Field label="Nama vendor"><Input value={vendor.name} onChange={(event) => updateVendor(vendor.id, { name: event.target.value })} /></Field>
          <Field label="Harga awal (excl. PPN)"><Input type="number" min="0" value={vendor.initialPrice || ""} onChange={(event) => updateVendor(vendor.id, { initialPrice: Number(event.target.value) })} /></Field>
          <Field label="Harga final (excl. PPN)"><Input type="number" min="0" value={vendor.finalPrice || ""} onChange={(event) => updateVendor(vendor.id, { finalPrice: Number(event.target.value) })} /></Field>
          <Field label={`Poin teknis / ${scales.technicalMax}`}><Input type="number" min="0" max={scales.technicalMax} value={vendor.technicalScore || ""} onChange={(event) => updateVendor(vendor.id, { technicalScore: Number(event.target.value) })} /></Field>
          <Field label="Keterangan"><Textarea rows={5} className="min-h-32 resize-y whitespace-pre-wrap" value={vendor.notes} onChange={(event) => updateVendor(vendor.id, { notes: event.target.value })} placeholder="Tulis mandays, termin pembayaran, ruang lingkup, dan catatan klarifikasi. Gunakan baris baru agar laporan lebih rapi." /><p className="text-right text-xs text-slate-400">{vendor.notes.length} karakter</p></Field>
          <div className="flex items-end"><Button variant="ghost" size="icon" aria-label="Hapus vendor" disabled={active.vendors.length <= 2} onClick={() => updateScorecard({ vendors: active.vendors.filter((item) => item.id !== vendor.id) })}><Trash2 /></Button></div>
        </div>)}
      </CardContent>
    </Card>

    <section className="grid gap-5 xl:grid-cols-[1fr_1.45fr]">
      <Card className="border-slate-200 shadow-sm"><CardHeader className="border-b border-slate-100"><CardTitle className="font-display text-lg">Cost efficiency</CardTitle><CardDescription>Harga terendah: {calculation.lowestPrice ? money.format(calculation.lowestPrice) : "belum tersedia"}</CardDescription></CardHeader><CardContent className="overflow-x-auto px-0"><Table><TableHeader><TableRow><TableHead className="pl-5">Vendor</TableHead><TableHead className="text-right">Diskon</TableHead><TableHead className="text-right">Diskon %</TableHead><TableHead className="pr-5 text-right">Poin komersial</TableHead></TableRow></TableHeader><TableBody>{calculation.results.map((vendor) => <TableRow key={vendor.id}><TableCell className="pl-5 font-medium">{vendor.name}</TableCell><TableCell className="text-right">{money.format(vendor.discountAmount)}</TableCell><TableCell className="text-right">{(vendor.discountPercent * 100).toFixed(2)}%</TableCell><TableCell className="pr-5 text-right font-semibold text-[#2075b8]">{vendor.commercialScore.toFixed(2)}</TableCell></TableRow>)}</TableBody></Table></CardContent></Card>
      <Card className="border-slate-200 shadow-sm"><CardHeader className="flex-row items-start justify-between border-b border-slate-100"><div><CardTitle className="font-display text-lg">Overall scoring</CardTitle><CardDescription>Peringkat otomatis berdasarkan nilai final; harga lebih rendah menjadi tie-breaker.</CardDescription></div>{calculation.ranking[0] && <Badge className="bg-emerald-600"><Trophy /> {calculation.ranking[0].name}</Badge>}</CardHeader><CardContent className="px-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead className="pl-5">Rank</TableHead><TableHead>Vendor</TableHead><TableHead className="text-right">Teknis</TableHead><TableHead className="text-right">Komersial</TableHead><TableHead className="text-right">Bobot T</TableHead><TableHead className="text-right">Bobot K</TableHead><TableHead className="pr-5 text-right">Final</TableHead></TableRow></TableHeader><TableBody>{calculation.ranking.map((vendor) => <TableRow key={vendor.id} className={vendor.rank === 1 ? "bg-emerald-50/70" : ""}><TableCell className="pl-5"><span className="grid size-7 place-items-center rounded-full bg-slate-100 font-bold">{vendor.rank}</span></TableCell><TableCell className="font-semibold">{vendor.name}</TableCell><TableCell className="text-right">{vendor.technicalScore.toFixed(2)}</TableCell><TableCell className="text-right">{vendor.commercialScore.toFixed(2)}</TableCell><TableCell className="text-right">{vendor.weightedTechnical.toFixed(2)}</TableCell><TableCell className="text-right">{vendor.weightedCommercial.toFixed(2)}</TableCell><TableCell className="pr-5 text-right font-bold text-emerald-700">{vendor.finalScore.toFixed(2)}</TableCell></TableRow>)}</TableBody></Table></div>{calculation.ranking[0] && <div className="mx-5 mb-5 mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><span className="font-medium">Vendor terpilih:</span> <strong>{calculation.ranking[0].name}</strong> dengan nilai akhir <strong>{calculation.ranking[0].finalScore.toFixed(2)}</strong>.</div>}</CardContent></Card>
    </section>

    <Card className="border-slate-200 shadow-sm"><CardContent className="flex flex-col items-start justify-between gap-4 p-5 lg:flex-row lg:items-center"><div className="flex items-start gap-3"><Scale className="mt-0.5 size-5 text-[#73d94b]" /><div><p className="font-semibold text-[#082f63]">Dokumen scoring siap dicetak</p><p className="mt-1 text-sm text-slate-500">PDF, DOCX, dan XLSX memuat ranking serta pernyataan vendor terpilih.</p><label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-slate-700"><Checkbox checked={Boolean(active.includeApproval)} onCheckedChange={(checked) => updateScorecard({ includeApproval: checked === true })} />Sertakan area approval/tanda tangan di PDF</label></div></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => { updateScorecard({ scheme: "normalized", technicalWeight: 70, commercialWeight: 30, technicalMaxScore: 100, commercialMaxScore: 100 }); toast.success("Parameter dikembalikan ke skema 70/30 skala 100.") }}><RotateCcw /> Reset skema</Button><Button variant="outline" onClick={() => { if (!validateExport()) return; downloadBlob(exportScorecardXlsx(active), `Scoring_Tender_${(active.projectName || "Project").replace(/[^a-z0-9]+/gi, "_")}.xlsx`) }}><FileSpreadsheet /> XLSX</Button><Button variant="outline" onClick={() => { if (!validateExport()) return; downloadBlob(exportScorecardDocx(active), `Scoring_Tender_${(active.projectName || "Project").replace(/[^a-z0-9]+/gi, "_")}.docx`) }}><FileText /> DOCX</Button><Button className="bg-[#082f63] hover:bg-[#174a7d]" onClick={() => { if (validateExport()) exportScorecardPdf(active) }}><FileDown /> PDF</Button></div></CardContent></Card>
    <AlertDialog open={batchDeleteOpen} onOpenChange={setBatchDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Hapus {selectedScorecards.length} scoring?</AlertDialogTitle><AlertDialogDescription>Draft scoring terpilih akan dihapus dari workspace browser.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction className="bg-rose-600" onClick={deleteSelectedScorecards}>Hapus Semua</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}
