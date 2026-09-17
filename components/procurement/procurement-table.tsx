"use client"

import { Pencil, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ProcurementRecord, ProcurementStatus } from "@/lib/procurement-types"

const statusStyle: Record<ProcurementStatus, string> = { Upcoming: "bg-slate-100 text-slate-700 border-slate-200", Ongoing: "bg-amber-50 text-amber-700 border-amber-200", PO: "bg-sky-50 text-sky-700 border-sky-200", Complete: "bg-emerald-50 text-emerald-700 border-emerald-200", Dropped: "bg-rose-50 text-rose-700 border-rose-200" }
const procurementTitle = (record: ProcurementRecord) => record.description || record.itemName || "Tanpa deskripsi"
const money = (value: number, currency = "IDR") => new Intl.NumberFormat("id-ID", { style: "currency", currency, maximumFractionDigits: 0 }).format(value)

export function ProcurementTable({ records, showRequestId = true, showOriginal = false, extended = false, onEdit, onDelete, selected, setSelected }: { records: ProcurementRecord[]; showRequestId?: boolean; showOriginal?: boolean; extended?: boolean; onEdit?: (record: ProcurementRecord) => void; onDelete?: (record: ProcurementRecord) => void; selected?: string[]; setSelected?: (ids: string[]) => void }) {
  const showActions = Boolean(onEdit || onDelete)
  const selectable = Boolean(selected && setSelected)
  const allSelected = Boolean(records.length && records.every((record) => selected?.includes(record.recordUid)))
  const toggleAll = (checked: boolean) => setSelected?.(checked ? [...new Set([...(selected ?? []), ...records.map((record) => record.recordUid)])] : (selected ?? []).filter((id) => !records.some((record) => record.recordUid === id)))
  const columnCount = 8 + Number(showRequestId) + Number(showOriginal) + Number(showActions) + Number(selectable) + (extended ? 4 : 0)

  return <Table className={extended ? "min-w-[1680px] table-fixed" : "min-w-[980px] table-fixed"}>
    <TableHeader><TableRow className="bg-slate-50/80">{selectable && <TableHead className="w-11 pl-5"><Checkbox checked={allSelected} onCheckedChange={(checked) => toggleAll(checked === true)} aria-label="Pilih semua pengadaan yang tampil" /></TableHead>}{showActions && <TableHead className="w-24">Aksi</TableHead>}{showRequestId && <TableHead className="w-40">Request ID</TableHead>}{showOriginal && <TableHead className="w-40">Request ID Asli</TableHead>}<TableHead className="w-72">Pengadaan</TableHead><TableHead className="w-40">Status</TableHead><TableHead className="w-28">Tanggal Request</TableHead><TableHead className="w-44">Requester</TableHead>{extended && <><TableHead className="w-44">Divisi</TableHead><TableHead className="w-40">Metode</TableHead><TableHead className="w-52">Vendor Terpilih</TableHead></>}<TableHead className="w-40">Nomor PO</TableHead>{extended && <TableHead className="w-28">Tanggal PO</TableHead>}<TableHead className="w-44 text-right">Nilai PO incl. PPN</TableHead><TableHead className="w-44 pr-5 text-right">Efisiensi</TableHead></TableRow></TableHeader>
    <TableBody>{records.length ? records.map((record) => <TableRow key={record.recordUid}>
      {selectable && <TableCell className="pl-5"><Checkbox checked={selected?.includes(record.recordUid)} onCheckedChange={(checked) => setSelected?.(checked === true ? [...(selected ?? []), record.recordUid] : (selected ?? []).filter((id) => id !== record.recordUid))} aria-label={`Pilih ${procurementTitle(record)}`} /></TableCell>}
      {showActions && <TableCell><div className="flex gap-1"><Button variant="ghost" size="icon-sm" aria-label={`Edit ${procurementTitle(record)}`} onClick={() => onEdit?.(record)}><Pencil /></Button><Button variant="ghost" size="icon-sm" className="text-rose-600 hover:bg-rose-50 hover:text-rose-700" aria-label={`Hapus ${procurementTitle(record)}`} onClick={() => onDelete?.(record)}><Trash2 /></Button></div></TableCell>}
      {showRequestId && <TableCell><span className="break-all rounded-md bg-[#eaf2fb] px-2 py-1 font-mono text-xs font-semibold text-[#082f63]">{record.requestId}</span></TableCell>}
      {showOriginal && <TableCell className="break-all text-xs text-slate-400">{record.originalRequestId || "—"}</TableCell>}
      <TableCell><p className="break-words font-medium text-slate-900">{procurementTitle(record)}</p><p className="mt-1 break-words text-xs text-slate-400">{record.category || record.itemName}</p></TableCell>
      <TableCell><Badge variant="outline" className={statusStyle[record.status]}>{record.status}</Badge>{record.statusNotes && <p className="mt-1 break-words text-xs leading-4 text-slate-500">{record.statusNotes}</p>}</TableCell>
      <TableCell className="break-words text-slate-600">{record.requestDate || "—"}</TableCell>
      <TableCell className="break-words text-slate-600">{record.picName || "—"}</TableCell>
      {extended && <><TableCell className="break-words text-slate-600">{record.division || "—"}</TableCell><TableCell className="break-words text-slate-600">{record.procurementMethod || "—"}</TableCell><TableCell className="break-words font-medium text-slate-700">{record.selectedVendor || "—"}</TableCell></>}
      <TableCell className="break-all font-mono text-xs">{record.poNumber || "—"}</TableCell>
      {extended && <TableCell className="break-words text-slate-600">{record.poDate || "—"}</TableCell>}
      <TableCell className="break-words text-right font-medium">{record.poAmountIncl ? money(record.poAmountIncl, record.currency) : "—"}</TableCell>
      <TableCell className="break-words pr-5 text-right font-medium text-emerald-700">{record.efficiency ? money(record.efficiency, record.currency) : "—"}</TableCell>
    </TableRow>) : <TableRow><TableCell colSpan={columnCount} className="h-32 text-center text-slate-400">Tidak ada data yang sesuai.</TableCell></TableRow>}</TableBody>
  </Table>
}
