import type { ProcurementRecord } from "./procurement-types"

export type SlaMetric = {
  key: "procurement" | "memoApproval" | "fpc" | "total"
  label: string
  description: string
  averageDays: number | null
  calculable: number
  unavailable: number
}

function parseDate(value?: string) {
  if (!value) return null
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  return Number.isFinite(date.getTime()) ? date : null
}

/** Tanggal awal tidak dihitung; tanggal akhir dihitung jika jatuh pada Senin-Jumat. */
export function businessDaysBetween(startValue?: string, endValue?: string) {
  const start = parseDate(startValue)
  const end = parseDate(endValue)
  if (!start || !end || end < start) return null
  let total = 0
  const cursor = new Date(start)
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    const day = cursor.getUTCDay()
    if (day !== 0 && day !== 6) total += 1
  }
  return total
}

/** Menghitung rata-rata SLA hanya dari pengadaan berstatus Complete. */
export function calculateSlaMetrics(records: ProcurementRecord[]): SlaMetric[] {
  const completed = records.filter((record) => record.status === "Complete")
  const definitions = [
    { key: "procurement" as const, label: "SLA Proses Pengadaan", description: "Tanggal request → tanggal memo", duration: (record: ProcurementRecord) => businessDaysBetween(record.requestDate, record.memoDate) },
    { key: "memoApproval" as const, label: "SLA Approval Memo", description: "Tanggal memo → tanggal send FPC", duration: (record: ProcurementRecord) => businessDaysBetween(record.memoDate, record.fpcSentDate) },
    { key: "fpc" as const, label: "SLA FPC", description: "Tanggal send FPC → tanggal approval FPC", duration: (record: ProcurementRecord) => businessDaysBetween(record.fpcSentDate, record.fpcApprovalDate) },
    { key: "total" as const, label: "SLA Total Pengadaan", description: "Tanggal request → tanggal PO", duration: (record: ProcurementRecord) => businessDaysBetween(record.requestDate, record.poDate) },
  ]

  return definitions.map((definition) => {
    const durations = completed.map(definition.duration).filter((value): value is number => value !== null)
    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      averageDays: durations.length ? durations.reduce((total, value) => total + value, 0) / durations.length : null,
      calculable: durations.length,
      unavailable: completed.length - durations.length,
    }
  })
}
