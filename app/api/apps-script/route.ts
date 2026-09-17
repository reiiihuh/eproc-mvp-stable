export const dynamic = "force-dynamic"

const READ_ACTIONS = new Set([
  "getProcurementSession",
  "listReviewQueue",
  "getProcurementRequestDetail",
  "getProcurementWorkspace",
  "syncProcurementStatus",
])

function backendUrl() {
  const url = process.env.APPS_SCRIPT_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL || ""
  if (!url.startsWith("https://script.google.com/macros/s/") || !url.endsWith("/exec")) {
    throw new Error("URL deployment Apps Script /exec belum dikonfigurasi.")
  }
  return url
}

async function upstream(body: string, retryable: boolean) {
  let lastError: unknown
  for (let attempt = 0; attempt < (retryable ? 2 : 1); attempt += 1) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 18_000)
    try {
      const response = await fetch(backendUrl(), {
        method: "POST",
        headers: { "content-type": "text/plain;charset=utf-8" },
        body,
        cache: "no-store",
        redirect: "follow",
        signal: controller.signal,
      })
      if (attempt === 0 && retryable && [404, 408, 429, 500, 502, 503, 504].includes(response.status)) {
        await new Promise((resolve) => setTimeout(resolve, 450))
        continue
      }
      return response
    } catch (error) {
      lastError = error
      if (!retryable || attempt > 0) throw error
      await new Promise((resolve) => setTimeout(resolve, 450))
    } finally {
      clearTimeout(timeout)
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Apps Script tidak merespons.")
}

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const input = JSON.parse(body) as { action?: string }
    const response = await upstream(body, READ_ACTIONS.has(String(input.action || "")))
    const text = await response.text()
    let payload: unknown
    try { payload = JSON.parse(text) }
    catch {
      return Response.json({ ok: false, error: "APPS_SCRIPT_NON_JSON", message: `Apps Script mengembalikan respons tidak valid (${response.status}). Periksa deployment /exec.` }, { status: 502 })
    }
    return Response.json(payload, { status: response.ok ? 200 : 502 })
  } catch (error) {
    const timeout = error instanceof DOMException && error.name === "AbortError"
    return Response.json({
      ok: false,
      error: timeout ? "APPS_SCRIPT_TIMEOUT" : "APPS_SCRIPT_UNAVAILABLE",
      message: timeout ? "Apps Script terlalu lama merespons." : error instanceof Error ? error.message : "Apps Script tidak dapat dihubungi.",
    }, { status: 503 })
  }
}
