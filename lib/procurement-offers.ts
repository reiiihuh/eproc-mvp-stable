import type { ProcurementRecord } from "./procurement-types"

/** Keep the visible PO fields aligned with the selected vendor, including zero offers. */
export function syncWinnerToPo(record: ProcurementRecord, hadWinner = false): ProcurementRecord {
  if (record.procurementMethod !== "Pemilihan Langsung") return record
  const winner = record.offers.find((offer) => offer.winner)
  if (!winner && !hadWinner) return record
  const initialPriceExcl = winner?.initialOffer ?? 0
  const poAmountExcl = winner?.finalOffer ?? 0
  return {
    ...record,
    selectedVendor: winner?.vendor ?? "",
    initialPriceExcl,
    poAmountExcl,
    poAmountIncl: poAmountExcl * 1.11,
    efficiency: Math.max(0, initialPriceExcl - poAmountExcl) * 1.11,
  }
}
