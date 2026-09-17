type GoogleTokenResponse = { access_token?: string; error?: string }
type GoogleCredentialResponse = { credential?: string }

/**
 * Google Workspace integration used by both the Drive browser and Sheets
 * adapter. Tokens live only in React memory and disappear on refresh/logout.
 * Never put OAuth client secrets in this browser-side module.
 */

export type DriveItem = {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  size?: string
  webViewLink?: string
  iconLink?: string
  thumbnailLink?: string
  parents?: string[]
  capabilities?: { canEdit?: boolean }
}

export type DriveBreadcrumb = { id: string; name: string }

const FOLDER_MIME = "application/vnd.google-apps.folder"

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(config: { client_id: string; callback: (response: GoogleCredentialResponse) => void; auto_select?: boolean }): void
          prompt(callback?: (notification: { isNotDisplayed(): boolean; isSkippedMoment(): boolean }) => void): void
          disableAutoSelect(): void
        }
        oauth2: {
          initTokenClient(config: {
            client_id: string
            scope: string
            callback: (response: GoogleTokenResponse) => void
          }): { requestAccessToken(options?: { prompt?: string }): void }
        }
      }
    }
  }
}

/** Meminta ID token untuk autentikasi aplikasi; berbeda dari access token Drive/Sheets. */
export async function requestGoogleIdentity(clientId: string) {
  await loadGoogleIdentity()
  return new Promise<string>((resolve, reject) => {
    const timeout = window.setTimeout(() => reject(new Error("Login Google tidak mendapat respons.")), 60_000)
    window.google?.accounts.id.initialize({
      client_id: clientId,
      auto_select: false,
      callback: (response) => {
        window.clearTimeout(timeout)
        if (response.credential) resolve(response.credential)
        else reject(new Error("Google tidak memberikan ID token."))
      },
    })
    window.google?.accounts.id.prompt((notification) => {
      if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
        window.clearTimeout(timeout)
        reject(new Error("Popup login Google tidak tersedia. Izinkan popup/cookie lalu coba lagi."))
      }
    })
  })
}

export function clearGoogleIdentitySelection() {
  window.google?.accounts.id.disableAutoSelect()
}

let scriptPromise: Promise<void> | null = null

const loadGoogleIdentity = () => {
  if (window.google) return Promise.resolve()
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://accounts.google.com/gsi/client"
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("Google Identity Services gagal dimuat."))
    document.head.appendChild(script)
  })
  return scriptPromise
}

export async function requestDriveToken(clientId: string, silent = false) {
  await loadGoogleIdentity()
  return new Promise<string>((resolve, reject) => {
    const client = window.google?.accounts.oauth2.initTokenClient({
      client_id: clientId,
      // Full Drive access is intentional for the current e-proc workspace:
      // users can browse and organize existing procurement files, not only
      // files created through this application.
      scope: "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets",
      callback: (response) => {
        if (response.access_token) resolve(response.access_token)
        else reject(new Error(response.error || "Google Drive tidak memberikan access token."))
      },
    })
    if (!client) reject(new Error("Google OAuth belum siap."))
    else client.requestAccessToken(silent ? { prompt: "" } : undefined)
  })
}

async function driveFetch(token: string, url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, ...(init?.headers ?? {}) },
  })
  if (!response.ok) throw new Error(`Google Drive error ${response.status}`)
  return response.json()
}

export function isDriveFolder(item: DriveItem) {
  return item.mimeType === FOLDER_MIME
}

export async function listDriveItems(token: string, parentId = "root", search = "") {
  const parentQuery = search.trim()
    ? `name contains '${search.trim().replaceAll("'", "\\'")}' and trashed=false`
    : `'${parentId}' in parents and trashed=false`
  const params = new URLSearchParams({
    q: parentQuery,
    pageSize: "100",
    orderBy: "folder,name_natural",
    fields: "files(id,name,mimeType,modifiedTime,size,webViewLink,iconLink,thumbnailLink,parents,capabilities(canEdit))",
    spaces: "drive",
  })
  const result = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?${params}`)
  return (result.files ?? []) as DriveItem[]
}

export async function getDriveItem(token: string, fileId: string) {
  const fields = "id,name,mimeType,modifiedTime,size,webViewLink,iconLink,thumbnailLink,parents,capabilities(canEdit)"
  return driveFetch(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=${encodeURIComponent(fields)}`) as Promise<DriveItem>
}

export async function getDriveBreadcrumbs(token: string, folderId: string) {
  if (folderId === "root") return [{ id: "root", name: "Drive Saya" }]
  const trail: DriveBreadcrumb[] = []
  let currentId: string | undefined = folderId
  const visited = new Set<string>()
  while (currentId && currentId !== "root" && !visited.has(currentId)) {
    visited.add(currentId)
    const current = await getDriveItem(token, currentId)
    trail.unshift({ id: current.id, name: current.name })
    currentId = current.parents?.[0]
  }
  return [{ id: "root", name: "Drive Saya" }, ...trail]
}

export function drivePreviewUrl(item: DriveItem) {
  const id = encodeURIComponent(item.id)
  if (item.mimeType === "application/vnd.google-apps.document") return `https://docs.google.com/document/d/${id}/preview`
  if (item.mimeType === "application/vnd.google-apps.spreadsheet") return `https://docs.google.com/spreadsheets/d/${id}/preview`
  if (item.mimeType === "application/vnd.google-apps.presentation") return `https://docs.google.com/presentation/d/${id}/preview`
  if (item.mimeType === "application/vnd.google-apps.form") return `https://docs.google.com/forms/d/${id}/viewform`
  if (isDriveFolder(item)) return ""
  return `https://drive.google.com/file/d/${id}/preview`
}

export async function createDriveFolder(token: string, name: string, parentId = "root") {
  return driveFetch(token, "https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType,parents,webViewLink", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
  }) as Promise<DriveItem>
}

export async function renameDriveItem(token: string, fileId: string, name: string) {
  return driveFetch(token, `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,modifiedTime,size,webViewLink,parents,capabilities(canEdit)`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  }) as Promise<DriveItem>
}

async function findOrCreateFolder(token: string, name: string, parentId?: string) {
  const escaped = name.replaceAll("'", "\\'")
  const parentClause = parentId ? ` and '${parentId}' in parents` : ""
  const query = encodeURIComponent(`name='${escaped}' and mimeType='application/vnd.google-apps.folder' and trashed=false${parentClause}`)
  const found = await driveFetch(token, `https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`)
  if (found.files?.[0]?.id) return found.files[0].id as string
  const body = { name, mimeType: "application/vnd.google-apps.folder", ...(parentId ? { parents: [parentId] } : {}) }
  const created = await driveFetch(token, "https://www.googleapis.com/drive/v3/files?fields=id", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  return created.id as string
}

export async function uploadProcurementDocument(
  token: string,
  rootName: string,
  requestId: string,
  itemName: string,
  file: File,
) {
  const rootId = await findOrCreateFolder(token, rootName)
  const recordFolder = await findOrCreateFolder(token, `${requestId} - ${itemName}`.slice(0, 120), rootId)
  const boundary = `procurement_${Date.now()}`
  const metadata = { name: file.name, parents: [recordFolder] }
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
    `--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`,
    file,
    `\r\n--${boundary}--`,
  ])
  return driveFetch(token, "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  })
}
