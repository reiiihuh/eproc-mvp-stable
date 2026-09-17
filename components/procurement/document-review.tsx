"use client"

import { useCallback, useEffect, useState } from "react"
import { ExternalLink, FileCheck2, LoaderCircle, RefreshCw, Save } from "lucide-react"
import Swal from "sweetalert2"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import type { PortalReviewRepository } from "@/lib/portal-review-repository"
import type { PortalReviewDetail, PortalReviewDocument, PortalReviewRequest } from "@/lib/portal-review-types"

type Decision = "REVISION" | "APPROVE" | "REJECT" | "PROMOTE"
type DocumentDraft = { status: "VALID" | "REVISION_REQUIRED"; note: string }

const statusColor = (status: string) => status === "APPROVED_FOR_PROCESS" || status === "VALID" ? "bg-emerald-100 text-emerald-800" : status === "NEED_CLARIFICATION" || status === "REVISION_REQUIRED" ? "bg-amber-100 text-amber-800" : status === "REJECTED" ? "bg-rose-100 text-rose-800" : "bg-blue-100 text-blue-800"
const displayStatus = (status: string) => status.replaceAll("_", " ")
const alertSuccess = (title: string) => void Swal.fire({ icon: "success", title, showConfirmButton: false, timer: 1400, timerProgressBar: true, width: 360 })
const alertError = (title: string) => void Swal.fire({ icon: "error", title, showConfirmButton: false, timer: 2600, timerProgressBar: true, width: 380 })

export function DocumentReview({ repository, onQueueChange }: { repository: PortalReviewRepository; onQueueChange?: (count: number) => void }) {
  const [queue, setQueue] = useState<PortalReviewRequest[]>([])
  const [detail, setDetail] = useState<PortalReviewDetail | null>(null)
  const [decision, setDecision] = useState<Decision | "">("")
  const [note, setNote] = useState("")
  const [documentDrafts, setDocumentDrafts] = useState<Record<string, DocumentDraft>>({})
  const [busy, setBusy] = useState("")

  const loadQueue = useCallback(async () => {
    setBusy("queue")
    try {
      const next = await repository.listReviewQueue()
      setQueue(next)
      onQueueChange?.(next.length)
    } catch (error) { alertError(error instanceof Error ? error.message : "Review queue gagal dimuat.") }
    finally { setBusy("") }
  }, [onQueueChange, repository])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQueue(), 0)
    return () => window.clearTimeout(timer)
  }, [loadQueue])

  async function openRequest(request: PortalReviewRequest) {
    setBusy(request.requestId)
    try {
      const next = await repository.getRequestDetail(request.requestId)
      setDetail(next); setDecision(""); setNote("")
      setDocumentDrafts(Object.fromEntries(next.documents.map((doc) => [doc.documentId, { status: doc.reviewStatus === "REVISION_REQUIRED" ? "REVISION_REQUIRED" : "VALID", note: doc.reviewNote || "" }])))
    } catch (error) { alertError(error instanceof Error ? error.message : "Detail request gagal dimuat.") }
    finally { setBusy("") }
  }

  async function refreshDetail(requestId: string) {
    const next = await repository.getRequestDetail(requestId)
    setDetail(next)
    return next
  }

  async function saveDocument(document: PortalReviewDocument) {
    if (!detail) return
    const draft = documentDrafts[document.documentId]
    if (!draft || (draft.status === "REVISION_REQUIRED" && !draft.note.trim())) return alertError("Isi catatan revisi.")
    setBusy(`doc-${document.documentId}`)
    try {
      await repository.reviewDocument(detail.request.requestId, document.documentId, draft.status, draft.note)
      await refreshDetail(detail.request.requestId); alertSuccess("Tersimpan")
    } catch (error) { alertError(error instanceof Error ? error.message : "Review dokumen gagal disimpan.") }
    finally { setBusy("") }
  }

  async function submitDecision() {
    if (!detail || !decision) return
    if ((decision === "REVISION" || decision === "REJECT") && !note.trim()) return alertError("Isi catatan terlebih dahulu.")
    setBusy("decision")
    try {
      const id = detail.request.requestId
      if (decision !== "PROMOTE") {
        const reviews = detail.documents.filter((document) => document.versionNumber > 0).map((document) => ({ documentId: document.documentId, status: documentDrafts[document.documentId]?.status || "VALID" as const, note: documentDrafts[document.documentId]?.note || "" }))
        await repository.submitReview(id, decision, note, reviews)
      }
      if (decision === "PROMOTE") await repository.promoteToProcurement(id)
      await refreshDetail(id); await loadQueue(); setDecision(""); setNote("")
      alertSuccess("Review selesai")
    } catch (error) { alertError(error instanceof Error ? error.message : "Keputusan gagal disimpan.") }
    finally { setBusy("") }
  }

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <Card className="border-slate-200 shadow-sm"><CardHeader className="flex-row items-center justify-between"><div><CardTitle className="font-display">Document Review Queue</CardTitle><CardDescription>Pilih request untuk memeriksa dokumen dan mengambil keputusan.</CardDescription></div><Button variant="outline" size="sm" onClick={() => void loadQueue()}><RefreshCw className={busy === "queue" ? "animate-spin" : ""} /> Refresh</Button></CardHeader><CardContent className="overflow-x-auto px-0"><Table><TableHeader><TableRow className="bg-slate-50"><TableHead className="pl-6">Nomor</TableHead><TableHead>Requester</TableHead><TableHead>Divisi</TableHead><TableHead>Tipe</TableHead><TableHead>Status</TableHead><TableHead>Diajukan</TableHead><TableHead className="pr-6 text-right">Aksi</TableHead></TableRow></TableHeader><TableBody>{queue.map((request) => <TableRow key={request.requestId} className={detail?.request.requestId === request.requestId ? "bg-blue-50" : ""}><TableCell className="pl-6 font-semibold text-[#082f63]">{request.requestNumber}</TableCell><TableCell><p className="font-medium">{request.requesterName}</p><p className="text-xs text-slate-500">{request.requesterEmail}</p></TableCell><TableCell>{request.requesterDivision || "-"}</TableCell><TableCell>{request.requestType}</TableCell><TableCell><Badge className={statusColor(request.status)}>{displayStatus(request.status)}</Badge></TableCell><TableCell>{request.submittedAt || "-"}</TableCell><TableCell className="pr-6 text-right"><Button size="icon-sm" variant="outline" title="Buka review" aria-label="Buka review" onClick={() => void openRequest(request)}>{busy === request.requestId ? <LoaderCircle className="animate-spin" /> : <FileCheck2 />}</Button></TableCell></TableRow>)}{!queue.length && busy !== "queue" && <TableRow><TableCell colSpan={7} className="h-28 text-center text-slate-500">Tidak ada request yang perlu ditangani.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
    {detail && <ReviewWorkspace detail={detail} decision={decision} setDecision={setDecision} note={note} setNote={setNote} documentDrafts={documentDrafts} setDocumentDrafts={setDocumentDrafts} busy={busy} saveDocument={saveDocument} submitDecision={submitDecision} />}
  </div>
}

function ReviewWorkspace({ detail, decision, setDecision, note, setNote, documentDrafts, setDocumentDrafts, busy, saveDocument, submitDecision }: { detail: PortalReviewDetail; decision: Decision | ""; setDecision: (value: Decision | "") => void; note: string; setNote: (value: string) => void; documentDrafts: Record<string, DocumentDraft>; setDocumentDrafts: React.Dispatch<React.SetStateAction<Record<string, DocumentDraft>>>; busy: string; saveDocument: (document: PortalReviewDocument) => Promise<void>; submitDecision: () => Promise<void> }) {
  const request = detail.request
  const canReviewDocuments = ["SUBMITTED", "NEED_CLARIFICATION", "PROCUREMENT_REVIEW"].includes(request.status)
  const decisions: { value: Decision; label: string }[] = canReviewDocuments ? [{ value: "REVISION", label: "Revision" }, { value: "APPROVE", label: "Approve" }, { value: "REJECT", label: "Reject" }] : request.status === "APPROVED_FOR_PROCESS" && !request.masterRequestId ? [{ value: "PROMOTE", label: "Masukkan ke Master Pengadaan" }] : []
  return <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
    <div className="space-y-5"><Card><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle className="font-display text-xl">{request.requestNumber}</CardTitle><CardDescription>{request.requesterName} · {request.requesterEmail}</CardDescription></div><Badge className={statusColor(request.status)}>{displayStatus(request.status)}</Badge></div></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-3"><Info label="Tipe" value={request.requestType} /><Info label="Divisi" value={request.requesterDivision} /><Info label="Jabatan" value={request.requesterPosition} /><Info label="Lokasi" value={request.requesterLocation} /><Info label="Diajukan" value={request.submittedAt} /><div className="sm:col-span-3"><Info label="Catatan requester" value={request.requesterNotes || "-"} /></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="font-display">Checklist Dokumen</CardTitle><CardDescription>Status dan catatan disimpan per dokumen.</CardDescription></CardHeader><CardContent className="space-y-3">{detail.documents.map((document) => { const draft = documentDrafts[document.documentId]; return <div key={document.documentId} className="grid gap-3 rounded-xl border border-slate-200 p-4 lg:grid-cols-[minmax(180px,1fr)_190px_minmax(220px,1fr)_auto]"><div><p className="font-semibold">{document.type} {document.required && <span className="text-rose-600">*</span>}</p><p className="text-xs text-slate-500">v{document.versionNumber} · {document.fileName || "Belum diunggah"}</p>{document.fileUrl && <Button asChild variant="ghost" size="icon-sm" title="Buka file"><a href={document.fileUrl} target="_blank" rel="noreferrer" aria-label="Buka file"><ExternalLink /></a></Button>}</div><Select disabled={!canReviewDocuments || !document.versionNumber} value={draft?.status || "VALID"} onValueChange={(value) => setDocumentDrafts((current) => ({ ...current, [document.documentId]: { status: value as DocumentDraft["status"], note: current[document.documentId]?.note || "" } }))}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="VALID">Valid</SelectItem><SelectItem value="REVISION_REQUIRED">Perlu revisi</SelectItem></SelectContent></Select><Textarea disabled={!canReviewDocuments || !document.versionNumber} value={draft?.note || ""} onChange={(event) => setDocumentDrafts((current) => ({ ...current, [document.documentId]: { status: current[document.documentId]?.status || "VALID", note: event.target.value } }))} rows={2} placeholder="Catatan dokumen..." /><Button size="icon" title="Simpan review" aria-label="Simpan review" disabled={!canReviewDocuments || !document.versionNumber || busy === `doc-${document.documentId}`} onClick={() => void saveDocument(document)}>{busy === `doc-${document.documentId}` ? <LoaderCircle className="animate-spin" /> : <Save />}</Button></div> })}</CardContent></Card></div>
    <div className="space-y-5"><Card className="sticky top-24"><CardHeader><CardTitle className="font-display">Keputusan</CardTitle><CardDescription>Pilih hasil review.</CardDescription></CardHeader><CardContent className="space-y-4">{decisions.length ? <><Select value={decision} onValueChange={(value) => setDecision(value as Decision)}><SelectTrigger className="w-full"><SelectValue placeholder="Pilih keputusan" /></SelectTrigger><SelectContent>{decisions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select><Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={5} placeholder="Catatan..." /><Button className="w-full bg-[#082f63]" disabled={!decision || Boolean(busy)} onClick={() => void submitDecision()}>{busy === "decision" && <LoaderCircle className="animate-spin" />} Submit</Button></> : <p className="rounded-xl bg-slate-50 p-4 text-sm text-slate-600">Tidak ada aksi lanjutan untuk status ini.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="font-display text-base">Riwayat</CardTitle></CardHeader><CardContent className="space-y-3">{detail.logs.map((log) => <div key={log.id} className="border-l-2 border-blue-200 pl-3"><p className="text-sm font-semibold">{displayStatus(log.eventType)}</p><p className="text-xs text-slate-500">{log.at} · {log.actorName || log.actorEmail}</p>{log.note && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{log.note}</p>}</div>)}</CardContent></Card></div>
  </div>
}

function Info({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</p><p className="mt-1 whitespace-pre-wrap break-words text-slate-800">{value || "-"}</p></div> }
