export const INDONESIAN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"]

/** Date-only values keep their calendar day; timestamps use Jakarta time. */
export function formatIndonesianDate(value?: string | Date | null): string {
  if (!value) return ""
  let iso = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ""
  if (!iso) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ""
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date)
    iso = ["year", "month", "day"].map(type => parts.find(part => part.type === type)?.value).join("-")
  }
  const [year, month, day] = iso.split("-")
  return `${day}-${INDONESIAN_MONTHS[Number(month) - 1]}-${year}`
}

export function formatIndonesianDateTime(value?: string | Date | null): string {
  const date = formatIndonesianDate(value)
  if (!date || !value) return ""
  return `${date} ${new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" }).format(new Date(value))} WIB`
}
