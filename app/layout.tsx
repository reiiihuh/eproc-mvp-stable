import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "e-Proc MVP",
  description: "Workspace pengadaan IT berbasis file dengan tender, dashboard, dokumen, dan export laporan.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  other: { "codex-preview": "development" },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body className="antialiased">{children}</body></html>
}
