/** Memuat logo yang sama dengan sidebar sebagai data URL untuk dokumen PDF. */
export async function loadNanoBankLogo() {
  const response = await fetch("/brand/nanobank-syariah.png")
  if (!response.ok) throw new Error("Logo NanoBank gagal dimuat.")
  const blob = await response.blob()
  const sourceUrl = URL.createObjectURL(blob)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error("Logo NanoBank gagal diproses."))
      element.src = sourceUrl
    })
    // Asset sumber memiliki whitespace besar; crop konten agar logo terbaca jelas di header PDF.
    const canvas = document.createElement("canvas")
    canvas.width = 980
    canvas.height = 300
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Canvas logo tidak tersedia.")
    context.drawImage(image, 0, 330, 960, 300, 0, 0, 960, 300)
    return canvas.toDataURL("image/png")
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
}
