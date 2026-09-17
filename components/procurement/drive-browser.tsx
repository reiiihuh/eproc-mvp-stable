"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  ChevronRight,
  Cloud,
  ExternalLink,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderPlus,
  Pencil,
  Presentation,
  RefreshCw,
  Search,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  createDriveFolder,
  drivePreviewUrl,
  getDriveBreadcrumbs,
  isDriveFolder,
  listDriveItems,
  renameDriveItem,
  type DriveBreadcrumb,
  type DriveItem,
} from "@/lib/google-drive"

const formatDate = (value?: string) => value
  ? new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
  : "—"

const formatSize = (value?: string) => {
  const bytes = Number(value)
  if (!bytes) return "—"
  const units = ["B", "KB", "MB", "GB"]
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** index).toFixed(index ? 1 : 0)} ${units[index]}`
}

function DriveIcon({ item }: { item: DriveItem }) {
  if (isDriveFolder(item)) return <Folder className="size-5 fill-amber-300 text-amber-500" />
  if (item.mimeType.includes("spreadsheet") || item.mimeType.includes("excel")) return <FileSpreadsheet className="size-5 text-emerald-600" />
  if (item.mimeType.includes("presentation") || item.mimeType.includes("powerpoint")) return <Presentation className="size-5 text-orange-600" />
  if (item.mimeType.startsWith("image/")) return <FileImage className="size-5 text-violet-600" />
  if (item.mimeType.includes("document") || item.mimeType.includes("pdf") || item.mimeType.includes("word")) return <FileText className="size-5 text-sky-600" />
  return <File className="size-5 text-slate-500" />
}

export function DriveBrowser({ token, connectDrive }: { token: string; connectDrive: () => Promise<void> }) {
  const [items, setItems] = useState<DriveItem[]>([])
  const [breadcrumbs, setBreadcrumbs] = useState<DriveBreadcrumb[]>([{ id: "root", name: "Drive Saya" }])
  const [folderId, setFolderId] = useState("root")
  const [queryInput, setQueryInput] = useState("")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<DriveItem | null>(null)
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [editName, setEditName] = useState("")

  const load = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const [nextItems, nextTrail] = await Promise.all([
        listDriveItems(token, folderId, query),
        query ? Promise.resolve(null) : getDriveBreadcrumbs(token, folderId),
      ])
      setItems(nextItems)
      if (nextTrail) setBreadcrumbs(nextTrail)
      setSelected((current) => nextItems.find((item) => item.id === current?.id) ?? null)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Isi Google Drive gagal dimuat.")
    } finally {
      setLoading(false)
    }
  }, [token, folderId, query])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load())
    return () => window.cancelAnimationFrame(frame)
  }, [load])

  const previewUrl = useMemo(() => selected ? drivePreviewUrl(selected) : "", [selected])

  function openFolder(item: DriveItem) {
    setFolderId(item.id)
    setQuery("")
    setQueryInput("")
    setSelected(null)
  }

  async function createFolder() {
    if (!editName.trim()) return
    try {
      await createDriveFolder(token, editName.trim(), folderId)
      setCreateOpen(false)
      setEditName("")
      await load()
      toast.success("Folder berhasil dibuat.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Folder gagal dibuat.")
    }
  }

  async function renameSelected() {
    if (!selected || !editName.trim()) return
    try {
      const updated = await renameDriveItem(token, selected.id, editName.trim())
      setSelected(updated)
      setRenameOpen(false)
      setEditName("")
      await load()
      toast.success("Nama berhasil diperbarui.")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Nama gagal diperbarui.")
    }
  }

  if (!token) {
    return <Card className="mx-auto max-w-3xl border-slate-200 shadow-sm">
      <CardContent className="flex min-h-80 flex-col items-center justify-center gap-4 text-center">
        <div className="grid size-16 place-items-center rounded-2xl bg-cyan-50 text-[#2075b8]"><Cloud className="size-8" /></div>
        <div><h2 className="font-display text-xl font-bold text-slate-950">Hubungkan Google Drive</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">File tetap berada di akun Google yang dipilih. App hanya menampilkan dan membantu menavigasinya.</p></div>
        <Button onClick={() => void connectDrive()} className="bg-[#082f63]"><Cloud /> Hubungkan Drive</Button>
      </CardContent>
    </Card>
  }

  return <div className="mx-auto max-w-[1600px] space-y-4">
    <Card className="border-slate-200 shadow-sm">
      <CardContent className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center">
        <form className="relative min-w-0 flex-1" onSubmit={(event) => { event.preventDefault(); setQuery(queryInput.trim()) }}>
          <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
          <Input value={queryInput} onChange={(event) => setQueryInput(event.target.value)} className="pl-9" placeholder="Cari file dan folder di seluruh Drive..." />
        </form>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { setQuery(""); setQueryInput(""); void load() }}><RefreshCw className={loading ? "animate-spin" : ""} /> Refresh</Button>
          <Button variant="outline" onClick={() => { setEditName(""); setCreateOpen(true) }}><FolderPlus /> Folder baru</Button>
        </div>
      </CardContent>
    </Card>

    <div className="grid min-h-[650px] gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,.65fr)]">
      <Card className="min-w-0 border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 py-4">
          <div className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
            {query ? <><Badge variant="secondary">Hasil pencarian</Badge><span className="ml-1 truncate text-slate-500">“{query}”</span></> : breadcrumbs.map((crumb, index) => <div key={crumb.id} className="flex min-w-0 items-center gap-1"><Button variant="ghost" size="sm" className="h-8 max-w-52 px-2" onClick={() => { setFolderId(crumb.id); setSelected(null) }}><span className="truncate">{crumb.name}</span></Button>{index < breadcrumbs.length - 1 && <ChevronRight className="size-4 shrink-0 text-slate-300" />}</div>)}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-[minmax(0,1fr)_170px_90px] border-b border-slate-100 bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"><span>Nama</span><span>Diubah</span><span>Ukuran</span></div>
          <div className="max-h-[590px] overflow-y-auto">
            {loading ? <div className="grid h-48 place-items-center text-sm text-slate-500"><RefreshCw className="mr-2 inline size-4 animate-spin" />Memuat Drive...</div> : items.length ? items.map((item) => <button key={item.id} type="button" onDoubleClick={() => isDriveFolder(item) ? openFolder(item) : setSelected(item)} onClick={() => setSelected(item)} className={`grid w-full grid-cols-[minmax(0,1fr)_170px_90px] items-center border-b border-slate-100 px-4 py-3 text-left transition hover:bg-cyan-50/60 ${selected?.id === item.id ? "bg-cyan-50 ring-1 ring-inset ring-cyan-200" : "bg-white"}`}>
              <span className="flex min-w-0 items-center gap-3"><DriveIcon item={item} /><span className="truncate text-sm font-medium text-slate-800">{item.name}</span></span>
              <span className="truncate text-xs text-slate-500">{formatDate(item.modifiedTime)}</span>
              <span className="text-xs text-slate-500">{isDriveFolder(item) ? "Folder" : formatSize(item.size)}</span>
            </button>) : <div className="grid h-48 place-items-center px-6 text-center text-sm text-slate-500">Tidak ada file atau folder yang sesuai.</div>}
          </div>
        </CardContent>
      </Card>

      <Card className="min-w-0 overflow-hidden border-slate-200 shadow-sm">
        {selected ? <>
          <CardHeader className="border-b border-slate-100 py-4">
            <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 gap-3"><DriveIcon item={selected} /><div className="min-w-0"><CardTitle className="truncate font-display text-base">{selected.name}</CardTitle><CardDescription className="mt-1">Diubah {formatDate(selected.modifiedTime)}</CardDescription></div></div><div className="flex shrink-0 gap-1">
              {selected.capabilities?.canEdit && <Button size="icon-sm" variant="ghost" aria-label="Ubah nama" onClick={() => { setEditName(selected.name); setRenameOpen(true) }}><Pencil /></Button>}
              {selected.webViewLink && <Button size="icon-sm" variant="ghost" aria-label="Buka atau edit di Google Drive" asChild><a href={selected.webViewLink} target="_blank" rel="noreferrer"><ExternalLink /></a></Button>}
            </div></div>
          </CardHeader>
          <CardContent className="p-0">
            {isDriveFolder(selected) ? <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 p-8 text-center"><Folder className="size-14 fill-amber-200 text-amber-500" /><div><h3 className="font-semibold">Folder dipilih</h3><p className="mt-1 text-sm text-slate-500">Buka untuk melihat isinya.</p></div><Button onClick={() => openFolder(selected)}>Buka folder</Button></div>
              : previewUrl ? <iframe key={selected.id} title={`Preview ${selected.name}`} src={previewUrl} className="h-[570px] w-full bg-slate-50" allow="autoplay" />
                : <div className="grid min-h-[520px] place-items-center p-8 text-center text-sm text-slate-500">Preview tidak tersedia untuk tipe file ini.</div>}
          </CardContent>
        </> : <CardContent className="flex min-h-[650px] flex-col items-center justify-center gap-3 text-center"><FileText className="size-11 text-slate-300" /><div><p className="font-medium text-slate-700">Pilih file untuk preview</p><p className="mt-1 text-sm text-slate-500">Klik dua kali folder untuk membukanya.</p></div></CardContent>}
      </Card>
    </div>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}><DialogContent><DialogHeader><DialogTitle>Folder baru</DialogTitle><DialogDescription>Folder dibuat di lokasi Drive yang sedang dibuka.</DialogDescription></DialogHeader><Input autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} placeholder="Nama folder" onKeyDown={(event) => { if (event.key === "Enter") void createFolder() }} /><DialogFooter><Button variant="outline" onClick={() => setCreateOpen(false)}>Batal</Button><Button onClick={() => void createFolder()}>Buat folder</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={renameOpen} onOpenChange={setRenameOpen}><DialogContent><DialogHeader><DialogTitle>Ubah nama</DialogTitle><DialogDescription>Perubahan diterapkan langsung di Google Drive.</DialogDescription></DialogHeader><Input autoFocus value={editName} onChange={(event) => setEditName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") void renameSelected() }} /><DialogFooter><Button variant="outline" onClick={() => setRenameOpen(false)}>Batal</Button><Button onClick={() => void renameSelected()}>Simpan</Button></DialogFooter></DialogContent></Dialog>
  </div>
}
