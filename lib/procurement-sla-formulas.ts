/** Keep in sync with procurementSlaFormulas_ in ProcurementReview.gs. */
export function procurementSlaFormulas(headers: string[], rowNumber: number): Record<string, string> {
  const normalize = (value: string) => value.replace(/\s+/g, " ").trim().toLowerCase()
  const normalized = headers.map(normalize)
  const cell = (header: string) => {
    let column = normalized.indexOf(normalize(header)) + 1
    if (!column) return ""
    let name = ""
    while (column) { column--; name = String.fromCharCode(65 + column % 26) + name; column = Math.floor(column / 26) }
    return name + rowNumber
  }
  const patches: Record<string, string> = {}
  headers.forEach((header) => {
    const name = normalize(header)
    if (!/^sla\b/.test(name)) return
    let dates: string[]
    if (/approval memo|persetujuan memo/.test(name)) dates = ["Tanggal Memo", "Tanggal Send FPC"]
    else if (/fpc/.test(name)) dates = ["Tanggal Send FPC", "Tanggal Approval FPC"]
    else if (/\bpo\b|total/.test(name)) dates = ["Tanggal Request", "Tanggal PO"]
    else if (/pengadaan/.test(name)) dates = ["Tanggal Request", "Tanggal Memo"]
    else return
    const start = cell(dates[0]), end = cell(dates[1])
    if (!start || !end) return
    // Accept native dates and legacy date text; exclude the start day's contribution.
    const startDate = `IF(ISNUMBER(${start}),INT(${start}),DATEVALUE(${start}))`
    const endDate = `IF(ISNUMBER(${end}),INT(${end}),DATEVALUE(${end}))`
    patches[header] = `=IFERROR(IF(OR(${start}="",${end}="",${endDate}<${startDate}),"",NETWORKDAYS(${startDate},${endDate})-NETWORKDAYS(${startDate},${startDate})),"")`
  })
  return patches
}
