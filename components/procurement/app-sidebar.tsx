"use client"

import Image from "next/image"
import { LogOut, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import type { AuthenticatedProcurement } from "@/components/procurement/procurement-access-gate"
import type { ProcurementView } from "@/components/procurement/procurement-ui-types"

export type ProcurementNavItem = { id: ProcurementView; label: string; icon: LucideIcon; badge?: number }

export function ProcurementSidebar({ view, setView, navItems, auth }: { view: ProcurementView; setView: (view: ProcurementView) => void; navItems: ProcurementNavItem[]; auth: AuthenticatedProcurement }) {
  const { isMobile, setOpenMobile } = useSidebar()
  const selectView = (next: ProcurementView) => {
    setView(next)
    if (isMobile) setOpenMobile(false)
  }

  return <Sidebar collapsible="icon" className="border-r border-[#214f7d] bg-[#082f63]">
    <SidebarHeader className="border-b border-white/10 px-3 py-4 group-data-[collapsible=icon]:px-1 group-data-[collapsible=icon]:py-3"><NanoBrand /></SidebarHeader>
    <SidebarContent className="bg-[#082f63] px-2 py-4"><SidebarGroup className="group-data-[collapsible=icon]:px-0"><SidebarGroupLabel className="text-[11px] uppercase tracking-[.16em] text-white/45">Workspace</SidebarGroupLabel><SidebarGroupContent><SidebarMenu>{navItems.map((item) => <SidebarMenuItem key={item.id}><SidebarMenuButton isActive={view === item.id} tooltip={item.label} onClick={() => selectView(item.id)} className="text-white/75 hover:bg-white/10 hover:text-white data-[active=true]:bg-[#73d94b] data-[active=true]:font-semibold data-[active=true]:text-[#082f63]"><item.icon /><span>{item.label}</span>{Boolean(item.badge) && <span className="ml-auto min-w-5 rounded-full bg-rose-500 px-1.5 text-center text-[10px] font-bold leading-5 text-white">{item.badge! > 99 ? "99+" : item.badge}</span>}</SidebarMenuButton></SidebarMenuItem>)}</SidebarMenu></SidebarGroupContent></SidebarGroup></SidebarContent>
    <SidebarFooter className="border-t border-white/10 bg-[#082f63] p-3 group-data-[collapsible=icon]:p-1"><div className="flex items-center gap-3 rounded-xl bg-white/7 p-2 text-white group-data-[collapsible=icon]:justify-center">{auth.session.picture ? <Image src={auth.session.picture} alt={auth.session.name} width={36} height={36} unoptimized className="size-9 shrink-0 rounded-full object-cover" referrerPolicy="no-referrer" /> : <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#73d94b] font-bold text-[#082f63]">{auth.session.name.slice(0, 1).toUpperCase()}</div>}<div className="min-w-0 flex-1 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-semibold">{auth.session.name}</p><p className="truncate text-[11px] text-white/55">Procurement Admin</p></div><Button size="icon-sm" variant="ghost" title="Keluar" className="text-white/60 hover:bg-white/10 hover:text-white group-data-[collapsible=icon]:hidden" onClick={auth.logout}><LogOut /></Button></div></SidebarFooter>
  </Sidebar>
}

function NanoBrand() {
  return <div className="flex items-center overflow-hidden group-data-[collapsible=icon]:justify-center" aria-label="NanoBank Syariah">
    <div className="relative h-[76px] w-[230px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm group-data-[collapsible=icon]:hidden"><Image src="/brand/nanobank-syariah.png" alt="NanoBank Syariah" width={228} height={228} unoptimized className="absolute left-px -top-[74px] h-[228px] w-[228px] max-w-none" /></div>
    <div className="relative hidden h-14 w-12 shrink-0 overflow-hidden rounded-2xl bg-white shadow-sm group-data-[collapsible=icon]:block"><Image src="/brand/nanobank-syariah.png" alt="NanoBank Syariah" width={360} height={360} unoptimized className="absolute -left-0.5 -top-[128px] h-[360px] w-[360px] max-w-none" /></div>
  </div>
}
