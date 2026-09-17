"use client"

import Image from "next/image"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"
import { LoaderCircle, LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { clearGoogleIdentitySelection, requestGoogleIdentity } from "@/lib/google-drive"
import { AppsScriptPortalReviewRepository } from "@/lib/portal-review-repository"
import type { ProcurementSession } from "@/lib/portal-review-types"

// Dashboard, chart, dan parser XLSX baru diunduh setelah login berhasil.
const ProcurementApp = dynamic(() => import("@/app/procurement-app"), {
  ssr: false,
  loading: () => <main className="grid min-h-screen place-items-center bg-[#f3f7fb]"><LoaderCircle className="size-7 animate-spin text-[#082f63]" /></main>,
})

export type AuthenticatedProcurement = { session: ProcurementSession; idToken: string; googleClientId: string; repository: AppsScriptPortalReviewRepository; logout: () => void }
type PublicConfig = { googleClientId: string; appsScriptUrl: string }

// Claim foto hanya untuk UI; role tetap diverifikasi Apps Script.
function profilePicture(idToken: string) {
  try {
    const raw = idToken.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")
    const value = raw.padEnd(Math.ceil(raw.length / 4) * 4, "=")
    return String((JSON.parse(decodeURIComponent(Array.from(atob(value), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""))) as { picture?: string }).picture || "")
  } catch { return "" }
}

export function ProcurementAccessGate() {
  const [auth, setAuth] = useState<AuthenticatedProcurement | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [config, setConfig] = useState<PublicConfig | null>(null)
  const restoreAttempted = useRef(false)
  const configured = Boolean(config?.googleClientId && config?.appsScriptUrl)

  useEffect(() => {
    fetch("/api/config").then((response) => response.json()).then((value: PublicConfig) => setConfig(value)).catch(() => { setConfig({ googleClientId: "", appsScriptUrl: "" }); setError("Konfigurasi login belum tersedia.") })
  }, [])

  useEffect(() => {
    if (!configured || auth || restoreAttempted.current) return
    const idToken = sessionStorage.getItem("eproc.google-id-token")
    if (!idToken) return
    restoreAttempted.current = true
    let cancelled = false
    const timer = window.setTimeout(() => {
      setBusy(true)
      const repository = new AppsScriptPortalReviewRepository(config!.appsScriptUrl, idToken)
      repository.getSession().then((session) => {
        if (session.role !== "PROCUREMENT_ADMIN") throw new Error("Akun tidak memiliki akses.")
        if (!cancelled) setAuth({ session: { ...session, picture: profilePicture(idToken) }, idToken, googleClientId: config!.googleClientId, repository, logout: () => { sessionStorage.removeItem("eproc.google-id-token"); clearGoogleIdentitySelection(); setAuth(null) } })
      }).catch(() => sessionStorage.removeItem("eproc.google-id-token")).finally(() => { if (!cancelled) setBusy(false) })
    }, 0)
    return () => { cancelled = true; window.clearTimeout(timer) }
  }, [configured, config, auth])

  async function login() {
    setBusy(true); setError("")
    try {
      if (!config || !configured) throw new Error("Konfigurasi login belum tersedia.")
      const idToken = await requestGoogleIdentity(config.googleClientId)
      const repository = new AppsScriptPortalReviewRepository(config.appsScriptUrl, idToken)
      const session = await repository.getSession()
      if (session.role !== "PROCUREMENT_ADMIN") throw new Error("Akun tidak memiliki akses.")
      sessionStorage.setItem("eproc.google-id-token", idToken)
      setAuth({ session: { ...session, picture: profilePicture(idToken) }, idToken, googleClientId: config.googleClientId, repository, logout: () => { sessionStorage.removeItem("eproc.google-id-token"); clearGoogleIdentitySelection(); setAuth(null) } })
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Login gagal.") }
    finally { setBusy(false) }
  }

  if (auth) return <ProcurementApp auth={auth} />
  return <main className="grid min-h-screen place-items-center bg-[#f3f7fb] p-5">
    <section className="w-full max-w-sm overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-[#082f63]/10">
      <div className="h-1.5 bg-[#73d94b]" />
      <div className="p-8"><div className="relative mx-auto h-28 w-full overflow-hidden"><Image src="/brand/nanobank-syariah.png" alt="NanoBank Syariah" fill priority unoptimized className="object-cover object-[center_42%]" /></div><div className="mt-8 text-center"><h1 className="font-display text-2xl font-bold text-[#082f63]">Procurement Control</h1><p className="mt-1 text-sm text-slate-500">Admin login</p></div><div className="mt-8 space-y-3">{error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-center text-sm text-rose-700">{error}</p>}<Button className="h-11 w-full rounded-lg bg-[#082f63] hover:bg-[#174a7d]" disabled={!configured || busy} onClick={login}>{busy ? <LoaderCircle className="animate-spin" /> : <LogIn />}{busy ? "Masuk..." : "Masuk dengan Google"}</Button></div></div>
    </section>
  </main>
}
