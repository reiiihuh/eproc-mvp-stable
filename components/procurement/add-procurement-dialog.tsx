"use client"

import { useState } from "react"
import { FilePlus2, Plus, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import type { ProcurementCurrency, ProcurementDocument, ProcurementPic, ProcurementRecord, ProcurementStatus, ProcurementVendor, TenderOffer } from "@/lib/procurement-types"
import { STATUS_ORDER } from "@/lib/procurement-types"

const emptyDocument = (): ProcurementDocument => ({
  id: crypto.randomUUID(),
  name: "",
  type: "Dokumen Pengadaan",
  webViewLink: "",
  state: "local",
})

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={`space-y-2 ${className}`}><Label>{label}</Label>{children}</div>
}

const currencyPrefix: Record<ProcurementCurrency, string> = { IDR: "Rp", USD: "US$", SGD: "S$" }
function MoneyField({ label, value, currency, onChange }: { label: string; value: number; currency: ProcurementCurrency; onChange: (value: number) => void }) {
  const formatted = value ? new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(value) : ""
  return <Field label={label}><div className="relative"><span className="pointer-events-none absolute left-3 top-2.5 text-sm font-semibold text-slate-500">{currencyPrefix[currency]}</span><Input className="pl-12" type="number" min="0" value={value || ""} onChange={(event) => onChange(Number(event.target.value))} /></div>{formatted && <p className="text-xs text-slate-500">{formatted}</p>}</Field>
}

export function AddProcurementDialog({
  open,
  setOpen,
  draft,
  pics,
  vendors,
  categories,
  updateDraft,
  selectPic,
  changeOffer,
  save,
  emptyOffer,
  mode = "create",
}: {
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
  mode?: "create" | "edit"
}) {
  // Controlled-form pattern: the parent owns `draft`; this component only
  // renders fields and reports typed changes back through callbacks.
  const activePics = pics.filter((pic) => pic.active).sort((a, b) => a.name.localeCompare(b.name, "id", { sensitivity: "base" }))
  const vendorNames = [...new Set(vendors.map((vendor) => vendor.name).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id", { sensitivity: "base" }))
  const [periodPreference, setPeriodPreference] = useState<Record<string, boolean>>({})
  const hasPeriod = periodPreference[draft.recordUid] ?? Boolean(draft.periodStart || draft.periodEnd)
  // Nilai perpajakan diturunkan dari harga tanpa PPN agar input user tetap sederhana dan konsisten.
  const taxMultiplier = 1.11
  const initialPriceExcl = draft.initialPriceExcl ?? 0
  const calculatedExpense = draft.poAmountExcl * taxMultiplier
  const calculatedEfficiency = Math.max(0, initialPriceExcl - draft.poAmountExcl) * taxMultiplier

  function updateDocument(index: number, patch: Partial<ProcurementDocument>) {
    updateDraft("documents", draft.documents.map((document, documentIndex) => documentIndex === index ? { ...document, ...patch } : document))
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle className="font-display text-xl">{mode === "edit" ? "Edit Pengadaan" : "Tambah Pengadaan"}</DialogTitle><DialogDescription>{mode === "edit" ? "Perbarui atribut master. Record UID tetap dipertahankan agar relasi Google Sheets tidak terputus." : "Request ID dibuat otomatis setelah disimpan. PIC dan metadata mengambil referensi workbook atau Google Sheets terakhir."}</DialogDescription></DialogHeader>
      <div className="grid gap-7 py-2">
        <section className="grid gap-4 sm:grid-cols-2">
          {mode === "edit" && <><Field label="Request ID"><Input value={draft.requestId} onChange={(event) => updateDraft("requestId", event.target.value)} /></Field><Field label="Request ID Asli"><Input value={draft.originalRequestId ?? ""} onChange={(event) => updateDraft("originalRequestId", event.target.value)} /></Field></>}
          <Field label="Tanggal Request *"><Input type="date" value={draft.requestDate} onChange={(event) => updateDraft("requestDate", event.target.value)} /></Field>
          <Field label="Status"><Select value={draft.status} onValueChange={(value) => updateDraft("status", value as ProcurementStatus)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent>{STATUS_ORDER.map((status) => <SelectItem value={status} key={status}>{status}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Keterangan Status" className="sm:col-span-2"><Textarea value={draft.statusNotes ?? ""} onChange={(event) => updateDraft("statusNotes", event.target.value)} rows={2} placeholder="Contoh: Menunggu approval memo dari user" /></Field>
          <Field label="Nama PIC *"><Input list="procurement-pic-options" value={draft.picName} onChange={(event) => { const value = event.target.value; const pic = activePics.find((item) => item.name === value); if (pic) selectPic(pic); else updateDraft("picName", value) }} placeholder={activePics.length ? "Cari atau pilih PIC (A–Z)" : "Import workbook untuk memuat PIC"} /><datalist id="procurement-pic-options">{activePics.map((pic) => <option value={pic.name} key={pic.id}>{pic.division}</option>)}</datalist></Field>
          <Field label="Divisi"><Input value={draft.division} onChange={(event) => updateDraft("division", event.target.value)} placeholder="Terisi otomatis dari PIC, tetap bisa dikoreksi" /></Field>
          <Field label="Jabatan"><Input value={draft.position} onChange={(event) => updateDraft("position", event.target.value)} /></Field>
          <Field label="Email"><Input value={draft.email} onChange={(event) => updateDraft("email", event.target.value)} /></Field>
          <Field label="Lokasi"><Input value={draft.location} onChange={(event) => updateDraft("location", event.target.value)} /></Field>
          <Field label="Nama Pengadaan *" className="sm:col-span-2"><Input value={draft.itemName} onChange={(event) => updateDraft("itemName", event.target.value)} placeholder="Contoh: Renewal EDB 2027" /></Field>
          <Field label="Deskripsi" className="sm:col-span-2"><Textarea value={draft.description} onChange={(event) => updateDraft("description", event.target.value)} rows={3} /></Field>
          <Field label="Kategori"><Select value={draft.category} onValueChange={(value) => updateDraft("category", value)}><SelectTrigger className="w-full"><SelectValue placeholder="Pilih kategori" /></SelectTrigger><SelectContent>{[...new Set([draft.category, ...categories].filter(Boolean))].map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select></Field>
          <Field label="Metode *"><Select value={draft.procurementMethod} onValueChange={(value) => updateDraft("procurementMethod", value)}><SelectTrigger className="w-full"><SelectValue placeholder="Pilih metode pengadaan" /></SelectTrigger><SelectContent><SelectItem value="Tender">Tender</SelectItem><SelectItem value="Pemilihan Langsung">Pemilihan Langsung</SelectItem><SelectItem value="Penunjukan Langsung">Penunjukan Langsung</SelectItem></SelectContent></Select></Field>
          <Field label="Currency"><Select value={draft.currency} onValueChange={(value) => updateDraft("currency", value as ProcurementCurrency)}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="IDR">IDR · Rupiah</SelectItem><SelectItem value="USD">USD · US Dollar</SelectItem><SelectItem value="SGD">SGD · Singapore Dollar</SelectItem></SelectContent></Select></Field>
          <Field label="Jenis Budget"><Select value={draft.budgetType ?? ""} onValueChange={(value) => updateDraft("budgetType", value as ProcurementRecord["budgetType"])}><SelectTrigger className="w-full"><SelectValue placeholder="Pilih budget" /></SelectTrigger><SelectContent><SelectItem value="CAPEX">CAPEX</SelectItem><SelectItem value="OPEX">OPEX</SelectItem><SelectItem value="BANK WIDE">BANK WIDE</SelectItem></SelectContent></Select></Field>
          <Field label="Kode Budget"><Input value={draft.budgetCode} onChange={(event) => updateDraft("budgetCode", event.target.value)} /></Field>
          <Field label="Bentuk/Request Type"><Input value={draft.requestType} onChange={(event) => updateDraft("requestType", event.target.value)} /></Field>
          <Field label="Jenis Permintaan"><Select value={draft.requestKind} onValueChange={(value) => updateDraft("requestKind", value)}><SelectTrigger className="w-full"><SelectValue placeholder="Pilih jenis permintaan" /></SelectTrigger><SelectContent>{!["", "Peripheral", "Non Peripheral"].includes(draft.requestKind) && <SelectItem value={draft.requestKind}>{draft.requestKind} (data lama)</SelectItem>}<SelectItem value="Peripheral">Peripheral</SelectItem><SelectItem value="Non Peripheral">Non Peripheral</SelectItem></SelectContent></Select></Field>
          <Field label="Qty"><Input type="number" min="1" value={draft.quantity || ""} onChange={(event) => updateDraft("quantity", Number(event.target.value))} /></Field>
          <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 sm:col-span-2"><Checkbox checked={hasPeriod} onCheckedChange={(checked) => { const enabled = checked === true; setPeriodPreference((current) => ({ ...current, [draft.recordUid]: enabled })); if (!enabled) { updateDraft("periodStart", ""); updateDraft("periodEnd", "") } }} /><span><strong>Pakai periode layanan</strong><span className="ml-1 text-slate-500">— untuk maintenance, subscription, lisensi, atau kontrak berjangka.</span></span></label>
          {hasPeriod && <><Field label="Periode Awal"><Input type="date" value={draft.periodStart ?? ""} onChange={(event) => updateDraft("periodStart", event.target.value)} /></Field><Field label="Periode Akhir"><Input type="date" value={draft.periodEnd ?? ""} onChange={(event) => updateDraft("periodEnd", event.target.value)} /></Field></>}
        </section>

        <section className="grid gap-4 border-t border-slate-200 pt-6 sm:grid-cols-2">
          <div className="sm:col-span-2"><h3 className="font-display text-base font-bold">Purchase Order & nilai</h3><p className="text-sm text-slate-500">Boleh dikosongkan untuk pengadaan Upcoming atau Ongoing.</p></div>
          <Field label="Tanggal Memo"><Input type="date" min={draft.requestDate || undefined} value={draft.memoDate ?? ""} onChange={(event) => updateDraft("memoDate", event.target.value)} /></Field>
          <Field label="Tanggal Persetujuan Direksi"><Input type="date" min={draft.memoDate || draft.requestDate || undefined} value={draft.directorApprovalDate ?? ""} onChange={(event) => updateDraft("directorApprovalDate", event.target.value)} /></Field>
          <Field label="Tanggal Kirim FPC"><Input type="date" min={draft.directorApprovalDate || draft.memoDate || draft.requestDate || undefined} value={draft.fpcSentDate ?? ""} onChange={(event) => updateDraft("fpcSentDate", event.target.value)} /></Field>
          <Field label="Tanggal Approval FPC"><Input type="date" min={draft.fpcSentDate || draft.directorApprovalDate || draft.memoDate || draft.requestDate || undefined} value={draft.fpcApprovalDate ?? ""} onChange={(event) => updateDraft("fpcApprovalDate", event.target.value)} /></Field>
          <Field label="Vendor Terpilih"><Input list="procurement-vendor-options" value={draft.selectedVendor} onChange={(event) => updateDraft("selectedVendor", event.target.value)} placeholder="Cari atau pilih vendor (A–Z)" /><datalist id="procurement-vendor-options">{vendorNames.map((vendor) => <option value={vendor} key={vendor} />)}</datalist></Field>
          <Field label="Nomor PO"><Input value={draft.poNumber} onChange={(event) => updateDraft("poNumber", event.target.value)} /></Field>
          <Field label="Tanggal PO"><Input type="date" min={draft.fpcApprovalDate || draft.fpcSentDate || draft.directorApprovalDate || draft.memoDate || draft.requestDate || undefined} value={draft.poDate ?? ""} onChange={(event) => updateDraft("poDate", event.target.value)} /></Field>
          <MoneyField label="Harga Awal Excl. PPN" value={initialPriceExcl} currency={draft.currency} onChange={(value) => updateDraft("initialPriceExcl", value)} />
          <MoneyField label="Harga Final Excl. PPN" value={draft.poAmountExcl} currency={draft.currency} onChange={(value) => updateDraft("poAmountExcl", value)} />
          <Field label="Amount PO Incl. PPN (otomatis)"><Input readOnly value={new Intl.NumberFormat("id-ID", { style: "currency", currency: draft.currency, maximumFractionDigits: 0 }).format(calculatedExpense)} className="bg-slate-50 font-semibold" /></Field>
          <Field label="Efficiency Incl. PPN (otomatis)"><Input readOnly value={new Intl.NumberFormat("id-ID", { style: "currency", currency: draft.currency, maximumFractionDigits: 0 }).format(calculatedEfficiency)} className="bg-emerald-50 font-semibold text-emerald-700" /><p className="text-xs text-slate-500">PPN 11% · saving {initialPriceExcl ? ((Math.max(0, initialPriceExcl - draft.poAmountExcl) / initialPriceExcl) * 100).toFixed(2) : "0.00"}%</p></Field>
        </section>

        <section className="space-y-4 border-t border-slate-200 pt-6">
          <div className="flex items-center justify-between"><div><h3 className="font-display text-base font-bold">Dokumen & link</h3><p className="text-sm text-slate-500">Dicatat manual; app tidak membuat atau memindahkan folder Drive.</p></div><Button type="button" variant="outline" size="sm" onClick={() => updateDraft("documents", [...draft.documents, emptyDocument()])}><FilePlus2 /> Dokumen</Button></div>
          {!draft.documents.length && <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center text-sm text-slate-500">Belum ada dokumen yang dicatat.</div>}
          {draft.documents.map((document, index) => <div key={document.id} className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_1.2fr_1.7fr_auto]">
            <Field label="Jenis"><Input value={document.type} onChange={(event) => updateDocument(index, { type: event.target.value })} placeholder="RFP, Quotation, PO..." /></Field>
            <Field label="Nama dokumen"><Input value={document.name} onChange={(event) => updateDocument(index, { name: event.target.value })} /></Field>
            <Field label="Link Google Drive"><Input type="url" value={document.webViewLink ?? ""} onChange={(event) => updateDocument(index, { webViewLink: event.target.value })} placeholder="https://drive.google.com/..." /></Field>
            <div className="flex items-end"><Button type="button" variant="ghost" size="icon" aria-label="Hapus dokumen" onClick={() => updateDraft("documents", draft.documents.filter((_, documentIndex) => documentIndex !== index))}><Trash2 /></Button></div>
          </div>)}
        </section>

        {draft.procurementMethod === "Tender" && <section className="space-y-4 border-t border-slate-200 pt-6">
          <div className="flex items-center justify-between"><div><h3 className="font-display text-base font-bold">Peserta tender</h3><p className="text-sm text-slate-500">Satu baris per vendor; pilih maksimal satu pemenang.</p></div><Button type="button" variant="outline" size="sm" onClick={() => updateDraft("offers", [...draft.offers, emptyOffer()])}><Plus /> Vendor</Button></div>
          {!draft.offers.length && <div className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Belum ada peserta.</div>}
          {draft.offers.map((offer, index) => <div key={offer.id} className={`grid gap-3 rounded-xl border p-4 md:grid-cols-[1.3fr_1fr_1fr_1fr_auto] ${offer.winner ? "border-emerald-300 bg-emerald-50/50" : "border-slate-200"}`}>
            <Field label={`Vendor ${index + 1}`}><Input list="procurement-vendor-options" value={offer.vendor} onChange={(event) => changeOffer(index, { vendor: event.target.value })} placeholder="Cari vendor" /></Field>
            <MoneyField label="Penawaran Awal" value={offer.initialOffer} currency={draft.currency} onChange={(value) => changeOffer(index, { initialOffer: value })} />
            <MoneyField label="BAFO" value={offer.bafo} currency={draft.currency} onChange={(value) => changeOffer(index, { bafo: value })} />
            <MoneyField label="Harga Final" value={offer.finalOffer} currency={draft.currency} onChange={(value) => changeOffer(index, { finalOffer: value })} />
            <div className="flex items-end gap-1"><Button type="button" size="sm" variant={offer.winner ? "default" : "outline"} className={offer.winner ? "bg-emerald-600" : ""} onClick={() => changeOffer(index, { winner: !offer.winner })}>{offer.winner ? "Pemenang" : "Pilih"}</Button><Button type="button" size="icon-sm" variant="ghost" onClick={() => updateDraft("offers", draft.offers.filter((_, offerIndex) => offerIndex !== index))}><Trash2 /></Button></div>
          </div>)}
        </section>}
      </div>
      <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button className="bg-[#082f63]" onClick={save}>{mode === "edit" ? "Simpan Perubahan" : "Simpan Pengadaan"}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
