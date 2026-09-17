"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { ProcurementRecord, ProcurementVendor } from "@/lib/procurement-types"

const money = (value: number) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(value)

export function VendorManagement({ vendors, records }: { vendors: ProcurementVendor[]; records: ProcurementRecord[] }) {
  const [division, setDivision] = useState("all")
  const [vendor, setVendor] = useState("all")
  const [search, setSearch] = useState("")
  const divisions = useMemo(() => [...new Set(records.map((item) => item.division).filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")), [records])
  const vendorNames = useMemo(() => [...new Set([...vendors.map((item) => item.name), ...records.map((item) => item.selectedVendor)].filter(Boolean))].sort((a, b) => a.localeCompare(b, "id")), [records, vendors])
  const rows = useMemo(() => records.filter((item) => item.selectedVendor && (division === "all" || item.division === division) && (vendor === "all" || item.selectedVendor === vendor) && [item.selectedVendor, item.division, item.itemName, item.description, item.requestId].join(" ").toLowerCase().includes(search.toLowerCase())), [division, records, search, vendor])
  const grouped = useMemo(() => {
    const byVendor = new Map<string, { name: string; count: number; amount: number; divisions: Set<string> }>()
    rows.forEach((item) => { const current = byVendor.get(item.selectedVendor) || { name: item.selectedVendor, count: 0, amount: 0, divisions: new Set<string>() }; current.count += 1; current.amount += item.poAmountIncl; if (item.division) current.divisions.add(item.division); byVendor.set(item.selectedVendor, current) })
    return [...byVendor.values()].sort((a, b) => b.amount - a.amount)
  }, [rows])

  return <div className="mx-auto max-w-[1500px] space-y-5">
    <Card><CardHeader><CardTitle className="font-display">Vendor Management</CardTitle><CardDescription>Analisis dua arah antara vendor, divisi requester, dan histori pengadaan.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-3"><Select value={division} onValueChange={setDivision}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua divisi</SelectItem>{divisions.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={vendor} onValueChange={setVendor}><SelectTrigger className="w-full"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua vendor</SelectItem>{vendorNames.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><div className="relative"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari pengadaan..." className="pl-9" /></div></CardContent></Card>
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{grouped.map((item) => <Card key={item.name}><CardHeader><CardTitle className="break-words text-base">{item.name}</CardTitle><CardDescription>{item.count} pengadaan · {money(item.amount)}</CardDescription></CardHeader><CardContent className="flex flex-wrap gap-2">{[...item.divisions].map((name) => <Badge key={name} variant="outline">{name}</Badge>)}</CardContent></Card>)}</section>
    <Card><CardHeader><CardTitle className="font-display">Histori Pengadaan</CardTitle><CardDescription>{rows.length} hasil sesuai filter.</CardDescription></CardHeader><CardContent className="overflow-x-auto px-0"><Table><TableHeader><TableRow className="bg-slate-50"><TableHead className="pl-6">Pengadaan</TableHead><TableHead>Vendor</TableHead><TableHead>Divisi Requester</TableHead><TableHead>Status</TableHead><TableHead className="pr-6 text-right">Nilai PO incl. PPN</TableHead></TableRow></TableHeader><TableBody>{rows.map((item) => <TableRow key={item.recordUid}><TableCell className="max-w-sm whitespace-normal break-words pl-6"><p className="font-medium">{item.itemName || item.description}</p><p className="text-xs text-slate-500">{item.requestId}</p></TableCell><TableCell className="max-w-xs whitespace-normal break-words">{item.selectedVendor}</TableCell><TableCell className="max-w-xs whitespace-normal break-words">{item.division || "-"}</TableCell><TableCell><Badge variant="outline">{item.status}</Badge></TableCell><TableCell className="pr-6 text-right">{money(item.poAmountIncl)}</TableCell></TableRow>)}{!rows.length && <TableRow><TableCell colSpan={5} className="h-28 text-center text-slate-500">Belum ada histori vendor yang sesuai.</TableCell></TableRow>}</TableBody></Table></CardContent></Card>
  </div>
}
