import { formatIndonesianDate, formatIndonesianDateTime } from "./indonesian-date.ts"
import * as XLSX from "xlsx"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

import { createDocx } from "./docx-export.ts"
import { loadNanoBankLogo } from "./brand-logo.ts"
import type { TenderScorecard } from "./procurement-types"

/**
 * Tender scoring domain logic and document exports.
 * Keep formulas here so the browser preview, ranking, PDF, DOCX, and XLSX all
 * calculate the same result from one source of truth.
 */
export type CalculatedScoringVendor = {
  id: string
  name: string
  initialPrice: number
  finalPrice: number
  discountAmount: number
  discountPercent: number
  technicalScore: number
  commercialScore: number
  weightedTechnical: number
  weightedCommercial: number
  finalScore: number
  notes: string
  rank: number
}

export function scoringScales(scorecard: TenderScorecard) {
  if (scorecard.scheme === "normalized") return { technicalMax: 100, commercialMax: 100 }
  if (scorecard.scheme === "weighted") return { technicalMax: scorecard.technicalWeight, commercialMax: scorecard.commercialWeight }
  return {
    technicalMax: Math.max(scorecard.technicalMaxScore, 1),
    commercialMax: Math.max(scorecard.commercialMaxScore, 1),
  }
}

/** Calculates ranking and explicitly marks the selected vendor (rank 1). */
export function calculateScorecard(scorecard: TenderScorecard) {
  const vendors = scorecard.vendors.filter((vendor) => vendor.name.trim())
  const validPrices = vendors.map((vendor) => vendor.finalPrice).filter((price) => price > 0)
  const lowestPrice = validPrices.length ? Math.min(...validPrices) : 0
  const { technicalMax, commercialMax } = scoringScales(scorecard)

  const results = vendors.map((vendor) => {
    const discountAmount = Math.max(0, vendor.initialPrice - vendor.finalPrice)
    const commercialScore = lowestPrice && vendor.finalPrice
      ? (lowestPrice / vendor.finalPrice) * commercialMax
      : 0
    const weightedTechnical = (Math.max(0, vendor.technicalScore) / technicalMax) * scorecard.technicalWeight
    const weightedCommercial = (commercialScore / commercialMax) * scorecard.commercialWeight
    return {
      ...vendor,
      discountAmount,
      discountPercent: vendor.initialPrice ? discountAmount / vendor.initialPrice : 0,
      commercialScore,
      weightedTechnical,
      weightedCommercial,
      finalScore: weightedTechnical + weightedCommercial,
      rank: 0,
    }
  })

  const ranked = [...results].sort((a, b) => b.finalScore - a.finalScore || a.finalPrice - b.finalPrice)
  const rankById = new Map(ranked.map((vendor, index) => [vendor.id, index + 1]))
  return {
    lowestPrice,
    technicalMax,
    commercialMax,
    results: results.map((vendor) => ({ ...vendor, rank: rankById.get(vendor.id) ?? 0 })),
    ranking: ranked.map((vendor, index) => ({ ...vendor, rank: index + 1 })),
  }
}

export function scorecardFormulaDescription(scorecard: TenderScorecard) {
  const { technicalMax, commercialMax } = scoringScales(scorecard)
  return {
    commercial: `(Harga terendah ÷ Harga vendor) × ${commercialMax}`,
    final: `(Poin teknis ÷ ${technicalMax} × ${scorecard.technicalWeight}%) + (Poin komersial ÷ ${commercialMax} × ${scorecard.commercialWeight}%)`,
  }
}

/** Membersihkan spasi hasil copy-paste tanpa menghilangkan paragraf yang dibuat user. */
function reportNotes(value: string) {
  return value.split(/\r?\n/).map((line) => line.replace(/[ \t]+/g, " ").replace(/(?:\b[\p{L}\p{N}]\s+){4,}[\p{L}\p{N}]/gu, (spaced) => spaced.replace(/\s+/g, "")).trim()).filter(Boolean).join("\n") || "-"
}

export function exportScorecardXlsx(scorecard: TenderScorecard) {
  const { results, ranking, technicalMax, commercialMax } = calculateScorecard(scorecard)
  const workbook = XLSX.utils.book_new()
  const startRow = 8
  const endRow = startRow + Math.max(results.length - 1, 0)
  const rows: unknown[][] = Array.from({ length: Math.max(endRow + 2, 16) }, () => Array(22).fill(""))

  rows[0][0] = `SCORING ${scorecard.projectName.toUpperCase() || "TENDER"}`
  rows[1][0] = "Nama Project"
  rows[1][1] = scorecard.projectName
  // Request ID dan evaluator disembunyikan sementara dari seluruh hasil export.
  rows[3][0] = "Tanggal Scoring"
  rows[3][1] = formatIndonesianDate(scorecard.scoringDate)

  rows[1][20] = "PARAMETER"
  rows[2][20] = "Skema"
  rows[2][21] = scorecard.scheme
  rows[3][20] = "Skala Teknis"
  rows[3][21] = technicalMax
  rows[4][20] = "Skala Komersial"
  rows[4][21] = commercialMax
  rows[5][20] = "Bobot Teknis"
  rows[5][21] = scorecard.technicalWeight
  rows[6][20] = "Bobot Komersial"
  rows[6][21] = scorecard.commercialWeight

  rows[5][0] = "COST EFFICIENCY AND DETAILS"
  rows[5][8] = "COMMERCIAL SCORING"
  rows[5][13] = "OVERALL SCORING - TECHNICAL AND COMMERCIAL"
  rows[6].splice(0, 19,
    "No", "Vendor", "Harga awal (Excl. PPN)", "Harga final (Excl. PPN)", "Total Diskon (IDR)", "Total Diskon (%)", "Keterangan", "",
    "Vendor", "Harga Final", "Poin Komersial", "", "",
    "Vendor", "Poin Teknis", "Poin Komersial", `Teknis ${scorecard.technicalWeight}%`, `Komersial ${scorecard.commercialWeight}%`, "Final",
  )

  results.forEach((vendor, index) => {
    const excelRow = startRow + index
    const row = rows[startRow - 1 + index]
    row[0] = index + 1
    row[1] = vendor.name
    row[2] = vendor.initialPrice
    row[3] = vendor.finalPrice
    row[4] = { f: `MAX(0,C${excelRow}-D${excelRow})`, v: vendor.discountAmount }
    row[5] = { f: `IFERROR(E${excelRow}/C${excelRow},0)`, v: vendor.discountPercent }
    row[6] = vendor.notes
    row[8] = vendor.name
    row[9] = vendor.finalPrice
    row[10] = { f: `IFERROR(MIN($J$${startRow}:$J$${endRow})/J${excelRow}*$V$5,0)`, v: vendor.commercialScore }
    row[13] = vendor.name
    row[14] = vendor.technicalScore
    row[15] = { f: `K${excelRow}`, v: vendor.commercialScore }
    row[16] = { f: `IFERROR(O${excelRow}/$V$4*$V$6,0)`, v: vendor.weightedTechnical }
    row[17] = { f: `IFERROR(P${excelRow}/$V$5*$V$7,0)`, v: vendor.weightedCommercial }
    row[18] = { f: `Q${excelRow}+R${excelRow}`, v: vendor.finalScore }
  })

  const sheet = XLSX.utils.aoa_to_sheet(rows)
  sheet["!merges"] = [
    XLSX.utils.decode_range("A1:S1"),
    XLSX.utils.decode_range("B2:F2"),
    XLSX.utils.decode_range("B3:F3"),
    XLSX.utils.decode_range("B4:F4"),
    XLSX.utils.decode_range("B5:F5"),
    XLSX.utils.decode_range("A6:G6"),
    XLSX.utils.decode_range("I6:L6"),
    XLSX.utils.decode_range("N6:S6"),
  ]
  sheet["!cols"] = [10, 24, 20, 20, 18, 16, 55, 4, 22, 20, 18, 4, 4, 24, 16, 18, 16, 18, 14, 4, 20, 16].map((wch) => ({ wch }))
  sheet["!rows"] = rows.map((_, index) => ({ hpt: index >= startRow - 1 && index <= endRow - 1 ? 54 : 20 }))
  for (let row = startRow; row <= endRow; row++) {
    for (const column of ["C", "D", "E", "J"]) if (sheet[`${column}${row}`]) sheet[`${column}${row}`].z = '"Rp"#,##0'
    if (sheet[`F${row}`]) sheet[`F${row}`].z = "0.00%"
    for (const column of ["K", "O", "P", "Q", "R", "S"]) if (sheet[`${column}${row}`]) sheet[`${column}${row}`].z = "0.00"
  }
  XLSX.utils.book_append_sheet(workbook, sheet, "Scoring Tender")

  const summary = XLSX.utils.aoa_to_sheet([
    ["RANKING SCORING TENDER"],
    ["Peringkat", "Vendor", "Poin Teknis", "Poin Komersial", `Teknis ${scorecard.technicalWeight}%`, `Komersial ${scorecard.commercialWeight}%`, "Final", "Harga Final"],
    ...ranking.map((vendor) => [vendor.rank, vendor.name, vendor.technicalScore, vendor.commercialScore, vendor.weightedTechnical, vendor.weightedCommercial, vendor.finalScore, vendor.finalPrice]),
    [],
    ["Vendor Terpilih", ranking[0]?.name || "—", "Nilai Akhir", ranking[0]?.finalScore ?? 0, "Harga Final", ranking[0]?.finalPrice ?? 0, "", ""],
  ])
  summary["!merges"] = [XLSX.utils.decode_range("A1:H1")]
  summary["!cols"] = [12, 24, 16, 18, 16, 18, 14, 20].map((wch) => ({ wch }))
  ranking.forEach((_, index) => {
    const row = index + 3
    for (const column of ["C", "D", "E", "F", "G"]) if (summary[`${column}${row}`]) summary[`${column}${row}`].z = "0.00"
    if (summary[`H${row}`]) summary[`H${row}`].z = '"Rp"#,##0'
  })
  const winnerRow = ranking.length + 4
  if (summary[`D${winnerRow}`]) summary[`D${winnerRow}`].z = "0.00"
  if (summary[`F${winnerRow}`]) summary[`F${winnerRow}`].z = '"Rp"#,##0'
  XLSX.utils.book_append_sheet(workbook, summary, "Ranking")

  return new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
}

export function exportScorecardDocx(scorecard: TenderScorecard) {
  const { ranking } = calculateScorecard(scorecard)
  const formulas = scorecardFormulaDescription(scorecard)
  return createDocx(
    `Scoring Tender · ${scorecard.projectName || "Project"}`,
    [
      `Tanggal scoring: ${formatIndonesianDate(scorecard.scoringDate) || "—"}`,
      `Bobot teknis ${scorecard.technicalWeight}% · komersial ${scorecard.commercialWeight}%`,
      `Rumus komersial: ${formulas.commercial}`,
      `Rumus final: ${formulas.final}`,
      `Vendor terpilih: ${ranking[0]?.name || "—"}${ranking[0] ? ` · Nilai akhir ${ranking[0].finalScore.toFixed(2)}` : ""}`,
    ],
    ["Rank", "Vendor", "Poin Teknis", "Poin Komersial", "Bobot Teknis", "Bobot Komersial", "Final", "Harga Final"],
    ranking.map((vendor) => [vendor.rank, vendor.name, vendor.technicalScore.toFixed(2), vendor.commercialScore.toFixed(2), vendor.weightedTechnical.toFixed(2), vendor.weightedCommercial.toFixed(2), vendor.finalScore.toFixed(2), new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(vendor.finalPrice)]),
  )
}

export async function exportScorecardPdf(scorecard: TenderScorecard) {
  const { results, ranking, technicalMax, commercialMax, lowestPrice } = calculateScorecard(scorecard)
  const formulas = scorecardFormulaDescription(scorecard)
  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
  const money = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })
  const generatedAt = formatIndonesianDateTime(new Date())

  pdf.setFillColor(8, 47, 99)
  pdf.rect(0, 0, 297, 30, "F")
  pdf.setFillColor(115, 217, 75)
  pdf.rect(0, 28, 297, 2, "F")
  const logo = await loadNanoBankLogo()
  pdf.addImage(logo, "PNG", 244, 6, 43, 14)
  pdf.setTextColor(255, 255, 255)
  pdf.setFontSize(17)
  pdf.text("BERITA ACARA SCORING TENDER", 14, 13)
  pdf.setFontSize(11)
  pdf.text(scorecard.projectName || "Nama project belum diisi", 14, 21)
  pdf.setFontSize(8)
  pdf.text(`Dicetak ${generatedAt} WIB`, 238, 12, { align: "right" })
  pdf.setTextColor(24, 36, 52)
  pdf.setFontSize(9)
  pdf.text(`Tanggal scoring: ${formatIndonesianDate(scorecard.scoringDate) || "-"}`, 14, 38)
  pdf.text(`Bobot: Teknis ${scorecard.technicalWeight}% · Komersial ${scorecard.commercialWeight}%`, 85, 38)
  pdf.text(`Skala: Teknis ${technicalMax} · Komersial ${commercialMax} · Harga terendah ${money.format(lowestPrice)}`, 174, 38)

  autoTable(pdf, {
    startY: 44,
    head: [["No", "Vendor", "Harga Awal", "Harga Final", "Diskon", "Diskon %", "Keterangan"]],
    body: results.map((vendor, index) => [index + 1, vendor.name, money.format(vendor.initialPrice), money.format(vendor.finalPrice), money.format(vendor.discountAmount), `${(vendor.discountPercent * 100).toFixed(2)}%`, reportNotes(vendor.notes)]),
    styles: { fontSize: 7, cellPadding: 1.7, valign: "middle", overflow: "linebreak", lineWidth: 0.1 },
    headStyles: { fillColor: [32, 117, 184], textColor: 255 },
    columnStyles: { 0: { cellWidth: 9 }, 1: { cellWidth: 34 }, 2: { cellWidth: 32 }, 3: { cellWidth: 32 }, 4: { cellWidth: 30 }, 5: { cellWidth: 19 }, 6: { cellWidth: 113 } },
    alternateRowStyles: { fillColor: [242, 248, 253] },
    rowPageBreak: "avoid",
  })

  const firstTableEnd = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 80
  autoTable(pdf, {
    startY: firstTableEnd + 8,
    head: [["Rank", "Vendor", "Poin Teknis", "Poin Komersial", `Teknis ${scorecard.technicalWeight}%`, `Komersial ${scorecard.commercialWeight}%`, "Final", "Harga Final"]],
    body: ranking.map((vendor) => [vendor.rank, vendor.name, vendor.technicalScore.toFixed(2), vendor.commercialScore.toFixed(2), vendor.weightedTechnical.toFixed(2), vendor.weightedCommercial.toFixed(2), vendor.finalScore.toFixed(2), money.format(vendor.finalPrice)]),
    styles: { fontSize: 7.2, cellPadding: 1.7, halign: "center", overflow: "linebreak" },
    headStyles: { fillColor: [8, 47, 99], textColor: 255 },
    columnStyles: { 1: { halign: "left" }, 7: { halign: "right" } },
    didParseCell: (data) => { if (data.section === "body" && data.row.index === 0) data.cell.styles.fontStyle = "bold" },
  })

  const secondTableEnd = (pdf as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 130
  // Page break hanya dibuat bila ruang fisik benar-benar tidak cukup.
  const requiredHeight = scorecard.includeApproval ? 76 : 43
  if (secondTableEnd + requiredHeight > 198) pdf.addPage()
  const resultY = secondTableEnd + requiredHeight > 198 ? 16 : secondTableEnd + 6
  const winner = ranking[0]
  pdf.setFillColor(238, 249, 233)
  pdf.roundedRect(14, resultY, 269, 18, 2, 2, "F")
  pdf.setTextColor(38, 116, 29)
  pdf.setFontSize(11)
  pdf.setFont("helvetica", "bold")
  pdf.text(`VENDOR TERPILIH: ${winner?.name || "-"}`, 18, resultY + 8)
  pdf.setFontSize(9)
  pdf.text(`Nilai akhir ${winner?.finalScore.toFixed(2) || "-"} · Harga final ${winner ? money.format(winner.finalPrice) : "-"}`, 18, resultY + 14)
  pdf.setTextColor(24, 36, 52)
  pdf.setFillColor(234, 242, 251)
  pdf.roundedRect(14, resultY + 23, 269, 20, 2, 2, "F")
  pdf.setFontSize(8)
  pdf.setFont("helvetica", "bold")
  pdf.text("Dasar perhitungan", 18, resultY + 29)
  pdf.setFont("helvetica", "normal")
  pdf.text(`Komersial: ${formulas.commercial}`, 18, resultY + 35)
  pdf.text(`Final: ${formulas.final}`, 18, resultY + 40)

  if (scorecard.includeApproval) {
    const signatureY = resultY + 51
    pdf.setFontSize(8)
    pdf.text("Disusun oleh,", 44, signatureY)
    pdf.text("Diperiksa oleh,", 135, signatureY)
    pdf.text("Disetujui oleh,", 228, signatureY)
    pdf.line(22, signatureY + 18, 82, signatureY + 18)
    pdf.line(105, signatureY + 18, 165, signatureY + 18)
    pdf.line(198, signatureY + 18, 258, signatureY + 18)
  }

  pdf.save(`Scoring_Tender_${(scorecard.projectName || "Project").replace(/[^a-z0-9]+/gi, "_")}.pdf`)
}
