export const dynamic = "force-dynamic"

/** Hanya mengirim konfigurasi OAuth public; credential rahasia tidak pernah diekspos. */
export async function GET() {
  const backendConfigured = Boolean(process.env.APPS_SCRIPT_URL || process.env.NEXT_PUBLIC_APPS_SCRIPT_URL)
  return Response.json({
    googleClientId: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "",
    // Browser memakai proxy same-origin agar redirect/CORS Apps Script lebih stabil.
    appsScriptUrl: backendConfigured ? "/api/apps-script" : "",
  })
}
