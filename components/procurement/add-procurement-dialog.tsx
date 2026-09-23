"use client"

import { useEffect, useState } from "react"
import { ExternalLink, FilePlus2, Plus, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DateInput } from "@/components/ui/date-input"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { ProcurementCurrency, ProcurementDocument, ProcurementPic, ProcurementRecord, ProcurementStatus, ProcurementVendor, TenderOffer } from "@/lib/procurement-types"
import { STATUS_ORDER } from "@/lib/procurement-types"

const RESERVED_DOCUMENT_TYPES = ["MEMO PEMBELIAN", "PO"]
const emptyDocument = (): ProcurementDocument => ({ id: crypto.randomUUID(), name: "", type: "Dokumen Pengadaan", webViewLink: "", state: "local" })

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}><Label>{label}</Label>{children}</div>
}

const currencyPrefix: Record<ProcurementCurrency, string> = { IDR: "Rp", USD: "US$", SGD: "S$" }
function MoneyField({ label, value, currency, onChange }: { label: string; value: number; currency: ProcurementCurrency; onChange: (value: number) => void }) {
  const formatted = value ? new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(value) : ""
  return <Field label={label}><div className="relative"><span className="pointer-events-none absolute left-3 top-2.5 text-sm font-semibold text-slate-500">{currencyPrefix[currency]}</span><Input className="pl-12" type="number" min="0" value={value || ""} onChange={(event) => onChange(Number(event.target.value))} /></div>{formatted && <p className="text-xs text-slate-500">{formatted}</p>}</Field>
}

export function AddProcurementDialog({ open, setOpen, draft, pics, vendors, categories, updateDraft, selectPic, changeOffer, save, emptyOffer, stageDocumentFile, mode = "create" }: {
  open: boolean
  setOpen: (open: boolean) => void
  draft: ProcurementRecord
  pics: ProcurementPic[]
  vendors: ProcurementVendor[]
  categories: string[]
  updateDraft: <K extends keyof ProcurementRecord>(key: K, value: ProcurementRecord[K]) => void
  selectPic: (pic: ProcurementPic) => void
  changeOffer: (index: number, patch: Partial<TenderOffer>) => void
  save: () => void
  emptyOffer: () => TenderOffer
  stageDocumentFile: (documentId: string, file: File | null) => void
  mode?: "create" | "edit"
}) {
  const activePics = pics.filter((pic) => pic.active).sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }))
  const vendorNames = [...new Set(vendors.map((vendor) => vendor.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id", { sensitivity: "base" }))
  const [periodPreference, setPeriodPreference] = useState<Record<string, boolean>>({})
  const hasPeriod = periodPreference[draft.recordUid] ?? Boolean(draft.periodStart || draft.periodEnd)
  const memoDocument = draft.documents.find((document) => document.type.toUpperCase() === "MEMO PEMBELIAN")
  const poDocument = draft.documents.find((document) => document.type.toUpperCase() === "PO")
  const hasPoEvidence = Boolean(draft.poNumber || draft.poDate || poDocument?.name || poDocument?.webViewLink)
  const poEnabled = draft.status === "Complete" || hasPoEvidence
  const initialPriceExcl = draft.initialPriceExcl ?? 0
  const calculatedExpense = draft.poAmountExcl * 1.11
  const calculatedEfficiency = Math.max(0, initialPriceExcl - draft.poAmountExcl) * 1.11

  useEffect(() => {
    if (open && hasPoEvidence && draft.status !== "Complete") updateDraft("status", "Complete")
  }, [draft.status, hasPoEvidence, open, updateDraft])

  function updateDocument(index: number, patch: Partial<ProcurementDocument>) {
    updateDraft("documents", draft.documents.map((document, documentIndex) => documentIndex === index ? { ...document, ...patch } : document))
  }

  function setTypedDocument(type: "MEMO PEMBELIAN" | "PO", file: File) {
    const current = draft.documents.find((document) => document.type.toUpperCase() === type)
    const next: ProcurementDocument = current ? { ...current, name: file.name, state: "local" } : { id: crypto.randomUUID(), name: file.name, type, state: "local" }
    updateDraft("documents", current ? draft.documents.map((document) => document.id === current.id ? next : document) : [...draft.documents, next])
    stageDocumentFile(next.id, file)
  }

  function changeStatus(status: ProcurementStatus) {
    if (status !== "Complete" && hasPoEvidence) {
      toast.error("Hapus Nomor, Tanggal, dan Dokumen PO sebelum mengubah status dari Complete.")
      return
    }
    updateDraft("status", status)
  }

  function attachmentControl(type: "MEMO PEMBELIAN" | "PO", document?: ProcurementDocument) {
    const inputId = `upload-${type.toLowerCase().replaceAll(" ", "-")}-${draft.recordUid}`
    return <div className="space-y-2">
      <Label>Dokumen {type === "PO" ? "PO" : "Memo"}</Label>
      <input id={inputId} type="file" className="sr-only" accept=".pdf,.doc,.docx,.xls,.xlsx,image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) setTypedDocument(type, file); event.target.value = "" }} />
      <div className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-2">
        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{document?.name || "Belum ada dokumen"}</span>
        {document?.webViewLink && <Button asChild type="button" variant="ghost" size="icon-sm"><a href={document.webViewLink} target="_blank" rel="noreferrer" aria-label={`Buka dokumen ${type}`}><ExternalLink /></a></Button>}
        <Button type="button" variant="outline" size="sm" onClick={() => window.document.getElementById(inputId)?.click()}><Upload /> {document ? "Ganti" : "Upload"}</Button>
      </div>
      {document?.state === "local" && <p className="text-xs text-amber-700">File akan diunggah saat pengadaan disimpan.</p>}
    </div>
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle className="font-display text-xl">{mode === "edit" ? "Edit Pengadaan" : "Tambah Pengadaan"}</DialogTitle><DialogDescription>{mode === "edit" ? "Perbarui data pengadaan. Nomor Request tidak dapat diubah." : "Nomor Request dibuat otomatis saat disimpan."}</DialogDescription></DialogHeader>
      <div className="grid gap-7 py-2">
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><h3 className="font-display text-base font-bold">Informasi Pengadaan</h3><p className="text-sm text-slate-500">Data utama request dan requester.</p></div>
          <Field label="Nomor Request"><Input value={mode === "edit" ? draft.requestId : ""} readOnly placeholder="Dibuat otomatis saat disimpan" /></Field>
          <Field label="Tanggal Request *"><DateInput aria-label="Tanggal Request *" value={draft.requestDate} onChange={(value) => updateDraft("requestDate", value)} /></Field>
          <Field label="Status"><Select value={draft.status} onValueChange={(value) => changeStatus(value as ProcurementStatus)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{STATUS_ORDER.map((status) => <SelectItem value={status} key={status}>{status}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Keterangan Status" className="sm:col-span-2"><Textarea value={draft.statusNotes ?? ""} onChange={(event) => updateDraft("statusNotes", event.target.value)} rows={2} /></Field>
          <Field label="Nama Requester *"><Input list="procurement-pic-options" value={draft.picName} onChange={(event) => { const value = event.target.value; const pic = activePics.find((item) => item.name === value); if (pic) selectPic(pic); else updateDraft("picName", value) }} placeholder="Cari atau pilih requester" /><datalist id="procurement-pic-options">{activePics.map((pic) => <option value={pic.name} key={pic.id}>{pic.division}</option>)}</datalist></Field>
          <Field label="Divisi"><Input value={draft.division} onChange={(event) => updateDraft("division", event.target.value)} /></Field>
          <Field label="Jabatan"><Input value={draft.position} onChange={(event) => updateDraft("position", event.target.value)} /></Field>
          <Field label="Email"><Input value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} /></Field>
          <Field label="Lokasi"><Input value={draft.location} onChange={(event) => updateDraft("location", event.target.value)} /></Field>
          <Field label="Nama Pengadaan *" className="sm:col-span-2"><Input value={draft.itemName} onChange={(event) => updateDraft("itemName", event.target.value)} /></Field>
          <Field label="Deskripsi" className="sm:col-span-2"><Textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} rows={3} /></Field>
          <Field label="Kategori"><Select value={draft.category} onValueChange={(value) => updateDraft("category", value)}><SelectTrigger className="w-full"><SelectValue placeholder="Pilih kategori" /></SelectTrigger><SelectContent>{[...new Set([draft.category, ...categories].filter(Boolean))].map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Currency"><Select value={draft.currency} onValueChange={(value) => updateDraft("currency", value as ProcurementCurrency)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="IDR">IDR · Rupiah</SelectItem><SelectItem value="USD">USD · US Dollar</SelectItem><SelectItem value="SGD">SGD · Singapore Dollar</SelectItem></SelectContent></Select></Field>
          <Field label="Bentuk/Request Type"><Input value={draft.requestType} onChange={(event) => updateDraft("requestType", event.target.value)} /></Field>
          <Field label="Jenis Permintaan"><Select value={draft.requestKind} onValueChange={(value) => updateDraft("requestKind", value)}><SelectTrigger className="w-full"><SelectValue placeholder="Pilih jenis permintaan" /></SelectTrigger><SelectContent>{!["", "Peripheral", "Non Peripheral"].includes(draft.requestKind) && <SelectItem value={draft.requestKind}>{draft.requestKind} (data lama)</SelectItem>}<SelectItem value="Peripheral">Peripheral</SelectItem><SelectItem value="Non Peripheral">Non Peripheral</SelectItem></SelectContent></Select></Field>
          <Field label="Qty"><Input type="number" min="1" value={draft.quantity || ""} onChange={(event) => updateDraft("quantity", Number(event.target.value))} /></Field>
          <Field label="Metode *"><Select value={draft.procurementMethod} onValueChange={(value) => updateDraft("procurementMethod", value)}><SelectTrigger className="w-full"><SelectValue placeholder="Pilih metode pengadaan" /></SelectTrigger><SelectContent><SelectItem value="Pemilihan Langsung">Pemilihan Langsung</SelectItem><SelectItem value="Penunjukan Langsung">Penunjukan Langsung</SelectItem></SelectContent></Select></Field>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:col-span-2"><Checkbox checked={hasPeriod} onCheckedChange={(checked) => { const enabled = checked === true; setPeriodPreference((current) => ({ ...current, [draft.recordUid]: enabled })); if (!enabled) { updateDraft("periodStart", ""); updateDraft("periodEnd", "") } }} /><span><strong>Pakai periode layanan</strong><span className="ml-1 text-slate-500">— maintenance, subscription, lisensi, atau kontrak berjangka.</span></span></label>
          {hasPeriod && <><Field label="Periode Awal"><DateInput aria-label="Periode Awal" value={draft.periodStart ?? ""} onChange={(value) => updateDraft("periodStart", value)} /></Field><Field label="Periode Akhir"><DateInput aria-label="Periode Akhir" value={draft.periodEnd ?? ""} onChange={(value) => updateDraft("periodEnd", value)} /></Field></>}
        </section>

        {draft.procurementMethod === "Pemilihan Langsung" && <section className="space-y-4 border-t border-slate-200 pt-6">
          <div className="flex items-center justify-between"><div><h3 className="font-display text-base font-bold">Vendor Peserta</h3><p className="text-sm text-slate-500">Satu baris per vendor; pilih maksimal satu pemenang.</p></div><Button type="button" variant="outline" size="sm" onClick={() => updateDraft("offers", [...draft.offers, emptyOffer()])}><Plus /> Vendor</Button></div>
          {!draft.offers.length && <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Belum ada peserta.</div>}
          {draft.offers.map((offer, index) => <div key={offer.id} className={`grid gap-3 rounded-xl border p-4 md:grid-cols-[1.3fr_1fr_1fr_auto] ${offer.winner ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200"}`}>
            <Field label={`Vendor ${index + 1}`}><Input list="procurement-vendor-options" value={offer.vendor} onChange={(event) => changeOffer(index, { vendor: event.target.value })} /></Field>
            <MoneyField label="Penawaran Awal" value={offer.initialOffer} currency={draft.currency} onChange={(value) => changeOffer(index, { initialOffer: value })} />
            <MoneyField label="Penawaran Akhir" value={offer.finalOffer} currency={draft.currency} onChange={(value) => changeOffer(index, { finalOffer: value })} />
            <div className="flex items-end gap-1"><Button type="button" size="sm" variant={offer.winner ? "default" : "outline"} className={offer.winner ? "bg-emerald-600" : ""} onClick={() => changeOffer(index, { winner: !offer.winner })}>{offer.winner ? "Pemenang" : "Pilih"}</Button><Button type="button" size="icon-sm" variant="ghost" onClick={() => updateDraft("offers", draft.offers.filter((_, offerIndex) => offerIndex !== index))}><Trash2 /></Button></div>
          </div>)}
        </section>}

        <section className="grid gap-4 rounded-2xl border border-sky-200 bg-sky-50/40 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><h3 className="font-display text-base font-bold">Memo Pembelian</h3><p className="text-sm text-slate-500">Identitas memo, persetujuan, dan anggaran.</p></div>
          <Field label="Nomor Memo Pembelian"><Input value={draft.memoNumber ?? ""} onChange={(event) => updateDraft("memoNumber", event.target.value)} /></Field>
          {attachmentControl("MEMO PEMBELIAN", memoDocument)}
          <Field label="Tanggal Memo"><DateInput aria-label="Tanggal Memo" min={draft.requestDate || undefined} value={draft.memoDate ?? ""} onChange={(value) => updateDraft("memoDate", value)} /></Field>
          <Field label="Tanggal Persetujuan Direksi"><DateInput aria-label="Tanggal Persetujuan Direksi" min={draft.memoDate || draft.requestDate || undefined} value={draft.directorApprovalDate ?? ""} onChange={(value) => updateDraft("directorApprovalDate", value)} /></Field>
          <Field label="Tanggal Kirim FPC"><DateInput aria-label="Tanggal Kirim FPC" min={draft.directorApprovalDate || draft.memoDate || draft.requestDate || undefined} value={draft.fpcSentDate ?? ""} onChange={(value) => updateDraft("fpcSentDate", value)} /></Field>
          <Field label="Tanggal Approval FPC"><DateInput aria-label="Tanggal Approval FPC" min={draft.fpcSentDate || draft.directorApprovalDate || draft.memoDate || draft.requestDate || undefined} value={draft.fpcApprovalDate ?? ""} onChange={(value) => updateDraft("fpcApprovalDate", value)} /></Field>
          <MoneyField label="Budget" value={draft.budget} currency={draft.currency} onChange={(value) => updateDraft("budget", value)} />
          <Field label="Jenis Budget"><Select value={draft.budgetType ?? ""} onValueChange={(value) => updateDraft("budgetType", value as ProcurementRecord["budgetType"])}><SelectTrigger className="w-full"><SelectValue placeholder="Pilih budget" /></SelectTrigger><SelectContent><SelectItem value="CAPEX">CAPEX</SelectItem><SelectItem value="OPEX">OPEX</SelectItem><SelectItem value="BANK WIDE">BANK WIDE</SelectItem></SelectContent></Select></Field>
          <Field label="Kode Budget"><Input value={draft.budgetCode} onChange={(event) => updateDraft("budgetCode", event.target.value)} /></Field>
        </section>

        <section className="grid gap-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><h3 className="font-display text-base font-bold">Purchase Order & Nilai</h3><p className="text-sm text-slate-500">Detail PO dibuka setelah status Complete atau pengadaan ditandai Sudah PO.</p></div>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-3 text-sm text-slate-700 sm:col-span-2"><Checkbox checked={poEnabled} onCheckedChange={(checked) => { if (checked === true) changeStatus("Complete"); else if (!hasPoEvidence) changeStatus("Ongoing"); else toast.error("Hapus data PO terlebih dahulu sebelum membatalkan status Sudah PO.") }} /><span><strong>Sudah PO</strong><span className="ml-1 text-slate-500">— otomatis mengubah status menjadi Complete.</span></span></label>
          {poEnabled && <>
            <Field label="Vendor Terpilih"><Input list="procurement-vendor-options" value={draft.selectedVendor} onChange={(event) => updateDraft("selectedVendor", event.target.value)} /><datalist id="procurement-vendor-options">{vendorNames.map((vendor) => <option value={vendor} key={vendor} />)}</datalist></Field>
            <Field label="Nomor PO *"><Input value={draft.poNumber} onChange={(event) => updateDraft("poNumber", event.target.value)} /></Field>
            {attachmentControl("PO", poDocument)}
            <Field label="Tanggal PO *"><DateInput aria-label="Tanggal PO" min={draft.fpcApprovalDate || draft.fpcSentDate || draft.directorApprovalDate || draft.memoDate || draft.requestDate || undefined} value={draft.poDate ?? ""} onChange={(value) => updateDraft("poDate", value)} /></Field>
            <MoneyField label="Penawaran Awal Excl. PPN" value={initialPriceExcl} currency={draft.currency} onChange={(value) => updateDraft("initialPriceExcl", value)} />
            <MoneyField label="Penawaran Akhir Excl. PPN" value={draft.poAmountExcl} currency={draft.currency} onChange={(value) => updateDraft("poAmountExcl", value)} />
            <Field label="Amount PO Incl. PPN (otomatis)"><Input readOnly value={new Intl.NumberFormat("id-ID", { style: "currency", currency: draft.currency, maximumFractionDigits: 0 }).format(calculatedExpense)} className="bg-white font-semibold" /></Field>
            <Field label="Efficiency Incl. PPN (otomatis)"><Input readOnly value={new Intl.NumberFormat("id-ID", { style: "currency", currency: draft.currency, maximumFractionDigits: 0 }).format(calculatedEfficiency)} className="bg-white font-semibold text-emerald-700" /></Field>
          </>}
        </section>

        <section className="space-y-4 border-t border-slate-200 pt-6">
          <div className="flex items-center justify-between"><div><h3 className="font-display text-base font-bold">Dokumen Tambahan</h3><p className="text-sm text-slate-500">Untuk RFP, quotation, BAST, dan dokumen selain Memo/PO.</p></div><Button type="button" variant="outline" size="sm" onClick={() => updateDraft("documents", [...draft.documents, emptyDocument()])}><FilePlus2 /> Dokumen</Button></div>
          {!draft.documents.some((document) => !RESERVED_DOCUMENT_TYPES.includes(document.type.toUpperCase())) && <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Belum ada dokumen tambahan.</div>}
          {draft.documents.map((document, index) => RESERVED_DOCUMENT_TYPES.includes(document.type.toUpperCase()) ? null : <div key={document.id} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_1.2fr_1.7fr_auto]">
            <Field label="Jenis"><Input value={document.type} onChange={(event) => updateDocument(index, { type: event.target.value })} /></Field>
            <Field label="Nama dokumen"><Input value={document.name} onChange={(event) => updateDocument(index, { name: event.target.value })} /></Field>
            <Field label="Link Google Drive"><Input type="url" value={document.webViewLink ?? ""} onChange={(event) => updateDocument(index, { webViewLink: event.target.value })} /></Field>
            <div className="flex items-end"><Button type="button" variant="ghost" size="icon" aria-label="Hapus dokumen" onClick={() => { stageDocumentFile(document.id, null); updateDraft("documents", draft.documents.filter((_, documentIndex) => documentIndex !== index)) }}><Trash2 /></Button></div>
          </div>)}
        </section>
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button className="bg-[#082f63]" onClick={save}>{mode === "edit" ? "Simpan Perubahan" : "Simpan Pengadaan"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
