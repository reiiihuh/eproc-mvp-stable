/**
 * Starts a browser download for an in-memory file and immediately releases
 * the temporary object URL. Every exporter uses this helper so download
 * behavior stays consistent.
 */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")

  link.href = url
  link.download = filename
  link.click()

  URL.revokeObjectURL(url)
}
