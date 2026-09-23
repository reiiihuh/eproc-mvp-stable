"use client"

import { useEffect, useMemo, useState } from "react"
import { Bell, CalendarDays, CheckCircle2, Clock3, FileCheck2, Moon, Pin, Sun } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatIndonesianDate, formatIndonesianDateTime } from "@/lib/indonesian-date"
import type { PortalReviewRequest } from "@/lib/portal-review-types"
import type { ProcurementRecord } from "@/lib/procurement-types"

type NotificationSort = "priority" | "oldest" | "newest" | "name"

export function NotificationCenter({ records, reviewQueue, onOpenRecord, onOpenReview }: {
  records: ProcurementRecord[]
  reviewQueue: PortalReviewRequest[]
  onOpenRecord: (record: ProcurementRecord) => void
  onOpenReview: () => void
}) {
  const [now, setNow] = useState(() => new Date())
  const [sort, setSort] = useState<NotificationSort>("priority")
  const [pinned, setPinned] = useState<string[]>(() => {
    if (typeof window === "undefined") return []
    try { return JSON.parse(window.localStorage.getItem("procurement-sheets-lab.pinned") || "[]") as string[] } catch { return [] }
  })

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => { window.localStorage.setItem("procurement-sheets-lab.pinned", JSON.stringify(pinned)) }, [pinned])

  const activeRecords = useMemo(() => records.filter((record) => ["Upcoming", "Ongoing"].includes(record.status)).sort((a, b) => {
    if (sort === "priority") {
      const pinResult = Number(pinned.includes(b.recordUid)) - Number(pinned.includes(a.recordUid))
      if (pinResult) return pinResult
    }
    if (sort === "name") return (a.description || a.itemName).localeCompare(b.description || b.itemName, "id")
    const dateResult = (a.requestDate || "9999-12-31").localeCompare(b.requestDate || "9999-12-31")
    return sort === "newest" ? -dateResult : dateResult
  }), [pinned, records, sort])

  const reviewItems = useMemo(() => [...reviewQueue].sort((a, b) => (a.submittedAt || a.updatedAt).localeCompare(b.submittedAt || b.updatedAt)), [reviewQueue])
  const total = reviewItems.length + activeRecords.length
  const jakartaHour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Jakarta" }).format(now))
  const period = jakartaHour < 6 ? "Malam" : jakartaHour < 11 ? "Pagi" : jakartaHour < 15 ? "Siang" : jakartaHour < 18 ? "Sore" : "Malam"
  const PeriodIcon = jakartaHour >= 6 && jakartaHour < 18 ? Sun : Moon
  const togglePin = (id: string) => setPinned((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id])

  return <div className="flex items-center gap-2">
    <div className="hidden items-center gap-2 lg:flex"><div className={`grid size-9 place-items-center rounded-xl ${period === "Malam" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"}`} title={period}><PeriodIcon className="size-4" /></div><div className="text-right"><p className="text-sm font-semibold text-slate-800">{formatIndonesianDate(now)}</p><p className="flex items-center justify-end gap-1 text-xs text-slate-500"><Clock3 className="size-3" />{new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(now)} WIB · {period}</p></div></div>
    <Popover>
      <PopoverTrigger asChild><Button variant="outline" size="icon" className="relative border-slate-200 bg-white" aria-label={`Notifikasi${total ? `, ${total} belum ditangani` : ""}`}><Bell />{total > 0 && <span className="absolute -right-1.5 -top-1.5 grid min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[11px] font-bold leading-5 text-white ring-2 ring-white">{Math.min(total, 99)}</span>}</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-[min(94vw,440px)] overflow-hidden p-0 shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3"><div className="flex items-center justify-between gap-3"><div><h2 className="font-display font-bold text-slate-900">Notifikasi</h2><p className="mt-0.5 text-xs text-slate-500">{reviewItems.length} review · {activeRecords.length} pengadaan aktif</p></div><Select value={sort} onValueChange={(value) => setSort(value as NotificationSort)}><SelectTrigger className="w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="priority">Prioritas</SelectItem><SelectItem value="oldest">Terlama</SelectItem><SelectItem value="newest">Terbaru</SelectItem><SelectItem value="name">Nama A–Z</SelectItem></SelectContent></Select></div></div>
        <div className="max-h-[500px] space-y-3 overflow-y-auto p-3">
          {reviewItems.length > 0 && <section className="overflow-hidden rounded-xl border border-rose-200 bg-rose-50/60">
            <button type="button" onClick={onOpenReview} className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-rose-100/60"><span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.12em] text-rose-700"><FileCheck2 className="size-4" />Document Review</span><Badge className="bg-rose-600 text-white">{reviewItems.length}</Badge></button>
            <div className="space-y-px border-t border-rose-100 bg-white">{reviewItems.slice(0, 6).map((request) => <button type="button" key={request.requestId} onClick={onOpenReview} className="flex w-full items-start gap-3 px-3 py-3 text-left transition hover:bg-rose-50">
              <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-rose-100 text-rose-700"><FileCheck2 className="size-4" /></div>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{request.requestNumber}</p><p className="mt-0.5 truncate text-xs text-slate-500">{request.requesterName} · {request.requestType}</p><p className="mt-1 text-xs font-medium text-rose-700">{request.status.replaceAll("_", " ")} · {formatIndonesianDateTime(request.submittedAt) || "Menunggu review"}</p></div>
            </button>)}</div>
            {reviewItems.length > 6 && <button type="button" onClick={onOpenReview} className="w-full border-t border-rose-100 px-3 py-2 text-center text-xs font-semibold text-rose-700 hover:bg-rose-100/60">Lihat {reviewItems.length - 6} request lainnya</button>}
          </section>}

          {activeRecords.length > 0 && <section className="rounded-xl border border-slate-100 bg-slate-50/60 p-2">
            <div className="flex items-center justify-between px-2 py-1.5"><h3 className="text-xs font-bold uppercase tracking-[.12em] text-slate-500">Pengadaan Aktif</h3><Badge variant="secondary">{activeRecords.length}</Badge></div>
            {activeRecords.slice(0, 8).map((record) => { const isPinned = pinned.includes(record.recordUid); return <div key={record.recordUid} className="group flex items-start gap-1 rounded-xl bg-white p-2 shadow-sm ring-1 ring-slate-100 transition hover:ring-blue-100">
              <button type="button" onClick={() => onOpenRecord(record)} className="flex min-w-0 flex-1 gap-3 rounded-lg p-1 text-left"><div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-600"><CalendarDays className="size-4" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-800">{record.description || record.itemName}</p><p className="mt-1 truncate text-xs text-slate-500">{record.picName || "Tanpa PIC"}</p>{record.requestDate && <p className="mt-1 text-xs font-medium text-[#2075b8]">{formatIndonesianDate(record.requestDate)}</p>}</div></button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label={isPinned ? "Lepas pin urgent" : "Pin sebagai urgent"} onClick={() => togglePin(record.recordUid)} className={isPinned ? "text-rose-600" : "text-slate-300 group-hover:text-slate-500"}><Pin className={isPinned ? "fill-current" : ""} /></Button>
            </div>})}
          </section>}

          {!total && <div className="px-6 py-12 text-center"><CheckCircle2 className="mx-auto size-9 text-emerald-400" /><p className="mt-3 text-sm font-medium text-slate-700">Semua sudah ditangani</p><p className="mt-1 text-xs text-slate-500">Belum ada review atau pengadaan aktif.</p></div>}
        </div>
      </PopoverContent>
    </Popover>
  </div>
}
