"use client"

import { useCallback, useEffect, useState } from "react"
import { LoaderCircle, Pencil, Power, UserCog, UserPlus } from "lucide-react"
import { toast } from "sonner"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AppsScriptPortalReviewRepository } from "@/lib/portal-review-repository"
import type { ProcurementAdminAccount } from "@/lib/portal-review-types"

type DraftAdmin = { email: string; name: string; active: boolean; originalEmail?: string }

const formatDate = (value: string) => {
  if (!value) return "Belum pernah login"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date)
}

export function AdminManagement({ repository, currentEmail }: { repository: AppsScriptPortalReviewRepository; currentEmail: string }) {
  const [admins, setAdmins] = useState<ProcurementAdminAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<DraftAdmin | null>(null)
  const [pendingStatus, setPendingStatus] = useState<ProcurementAdminAccount | null>(null)
  const domain = currentEmail.split("@")[1] || "domain organisasi"

  const loadAdmins = useCallback(async () => {
    setLoading(true)
    try { setAdmins(await repository.listProcurementAdmins()) }
    catch (error) { toast.error(error instanceof Error ? error.message : "Daftar admin gagal dimuat.") }
    finally { setLoading(false) }
  }, [repository])

  useEffect(() => { void loadAdmins() }, [loadAdmins])

  async function saveAdmin() {
    if (!draft?.email.trim() || !draft.name.trim()) return toast.error("Nama dan email admin wajib diisi.")
    setSaving(true)
    try {
      const items = await repository.upsertProcurementAdmin({ email: draft.email.trim(), name: draft.name.trim(), active: draft.active })
      setAdmins(items); setDraft(null); toast.success("Akses admin berhasil disimpan.")
    } catch (error) { toast.error(error instanceof Error ? error.message : "Akses admin gagal disimpan.") }
    finally { setSaving(false) }
  }

  async function toggleStatus() {
    if (!pendingStatus) return
    const target = pendingStatus
    setPendingStatus(null); setSaving(true)
    try {
      setAdmins(await repository.setProcurementAdminActive(target.email, !target.active))
      toast.success(`Akun ${target.active ? "dinonaktifkan" : "diaktifkan"}.`)
    } catch (error) { toast.error(error instanceof Error ? error.message : "Status admin gagal diperbarui.") }
    finally { setSaving(false) }
  }

  return <div className="mx-auto max-w-[1400px] space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="flex items-center gap-2 font-display text-xl font-bold text-[#082f63]"><UserCog className="size-5" />Admin Access</h2><p className="mt-1 text-sm text-slate-500">{admins.length} akun terdaftar · domain @{domain}</p></div><Button className="bg-[#082f63] hover:bg-[#174a7d]" onClick={() => setDraft({ email: "", name: "", active: true })}><UserPlus />Tambah Admin</Button></div>

    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><Table className="min-w-[900px] table-fixed"><TableHeader><TableRow className="bg-slate-50"><TableHead className="w-[24%] pl-6">Nama</TableHead><TableHead className="w-[28%]">Email</TableHead><TableHead className="w-[13%]">Status</TableHead><TableHead className="w-[21%]">Login terakhir</TableHead><TableHead className="w-[14%] pr-6 text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{loading ? <TableRow><TableCell colSpan={5} className="h-32 text-center"><LoaderCircle className="mx-auto size-5 animate-spin text-[#082f63]" /></TableCell></TableRow> : admins.map((admin) => <TableRow key={admin.email}><TableCell className="whitespace-normal break-words pl-6 font-medium">{admin.name}</TableCell><TableCell className="whitespace-normal break-all">{admin.email}{admin.email.toLowerCase() === currentEmail.toLowerCase() && <span className="ml-2 text-xs text-slate-400">(Anda)</span>}</TableCell><TableCell><Badge variant="outline" className={admin.active ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-600"}>{admin.active ? "Aktif" : "Nonaktif"}</Badge></TableCell><TableCell className="whitespace-normal text-sm text-slate-500">{formatDate(admin.lastLoginAt)}</TableCell><TableCell className="pr-6"><div className="flex justify-end gap-1"><Button size="icon-sm" variant="ghost" aria-label={`Edit ${admin.name}`} onClick={() => setDraft({ email: admin.email, originalEmail: admin.email, name: admin.name, active: admin.active })}><Pencil /></Button><Button size="icon-sm" variant="ghost" disabled={admin.email.toLowerCase() === currentEmail.toLowerCase()} className={admin.active ? "text-rose-600" : "text-emerald-700"} aria-label={admin.active ? "Nonaktifkan admin" : "Aktifkan admin"} onClick={() => setPendingStatus(admin)}><Power /></Button></div></TableCell></TableRow>)}{!loading && !admins.length && <TableRow><TableCell colSpan={5} className="h-28 text-center text-slate-500">Belum ada akun admin.</TableCell></TableRow>}</TableBody></Table></div></div>

    <Dialog open={Boolean(draft)} onOpenChange={(open) => { if (!open && !saving) setDraft(null) }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>{draft?.originalEmail ? "Edit Admin" : "Tambah Admin"}</DialogTitle><DialogDescription>Admin baru dapat masuk setelah login memakai akun Google dengan email yang sama.</DialogDescription></DialogHeader>{draft && <div className="space-y-4 py-2"><div className="space-y-2"><Label>Nama lengkap</Label><Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Nama admin" /></div><div className="space-y-2"><Label>Email organisasi</Label><Input type="email" value={draft.email} disabled={Boolean(draft.originalEmail)} onChange={(event) => setDraft({ ...draft, email: event.target.value })} placeholder={`nama@${domain}`} /><p className="text-xs text-slate-500">Email tidak dapat diubah setelah akun dibuat.</p></div></div>}<DialogFooter><Button variant="outline" disabled={saving} onClick={() => setDraft(null)}>Batal</Button><Button disabled={saving} onClick={() => void saveAdmin()}>{saving && <LoaderCircle className="animate-spin" />}Simpan Admin</Button></DialogFooter></DialogContent></Dialog>

    <AlertDialog open={Boolean(pendingStatus)} onOpenChange={(open) => { if (!open) setPendingStatus(null) }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{pendingStatus?.active ? "Nonaktifkan" : "Aktifkan"} akun admin?</AlertDialogTitle><AlertDialogDescription>{pendingStatus?.email} {pendingStatus?.active ? "langsung kehilangan akses ke dashboard setelah sesi berikutnya diverifikasi." : "akan kembali memiliki akses Procurement Admin."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Batal</AlertDialogCancel><AlertDialogAction className={pendingStatus?.active ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700"} onClick={() => void toggleStatus()}>Ya, lanjutkan</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>
}
