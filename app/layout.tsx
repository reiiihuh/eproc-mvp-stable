import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "e-Proc Dashboard Dev",
  description: "Workspace pengadaan IT berbasis file dengan pemilihan langsung, dashboard, dokumen, dan export laporan.",
  icons: { icon: "/favicon.png", shortcut: "/favicon.png" },
  other: { "codex-preview": "development" },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body className="antialiased">{children}</body></html>
}
