import type { ProcurementRecord } from "./procurement-types"

export type SlaMetric = {
  key: "memo" | "fpc" | "procurement"
  label: string
  description: string
  averageDays: number | null
  calculable: number
  unavailable: number
}

const DAY_MS = 86_400_000

function elapsedDays(startValue?: string, endValue?: string) {
  if (!startValue || !endValue) return null
  const start = new Date(`${startValue.slice(0, 10)}T00:00:00Z`).getTime()
  const end = new Date(`${endValue.slice(0, 10)}T00:00:00Z`).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null
  return (end - start) / DAY_MS
}

/** Menghitung rata-rata hari kalender hanya dari proyek dengan pasangan tanggal valid. */
export function calculateSlaMetrics(records: ProcurementRecord[]): SlaMetric[] {
  const definitions = [
    { key: "memo" as const, label: "SLA Memo", description: "Tanggal memo → persetujuan direksi", duration: (record: ProcurementRecord) => elapsedDays(record.memoDate, record.directorApprovalDate) },
    { key: "fpc" as const, label: "SLA FPC", description: "Kirim FPC → approval FPC", duration: (record: ProcurementRecord) => elapsedDays(record.fpcSentDate, record.fpcApprovalDate) },
    { key: "procurement" as const, label: "SLA Pengadaan", description: "Tanggal memo → tanggal PO", duration: (record: ProcurementRecord) => elapsedDays(record.memoDate, record.poDate) },
  ]

  return definitions.map((definition) => {
    const durations = records.map(definition.duration).filter((value): value is number => value !== null)
    return {
      key: definition.key,
      label: definition.label,
      description: definition.description,
      averageDays: durations.length ? durations.reduce((total, value) => total + value, 0) / durations.length : null,
      calculable: durations.length,
      unavailable: records.length - durations.length,
    }
  })
}
