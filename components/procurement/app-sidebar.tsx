"use client"

import Image from "next/image"
import { useState } from "react"
import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, useSidebar } from "@/components/ui/sidebar"
import type { AuthenticatedProcurement } from "@/components/procurement/procurement-access-gate"
import type { ProcurementView } from "@/components/procurement/procurement-ui-types"

export type ProcurementNavItem = { id: ProcurementView; label: string; icon: LucideIcon; badge?: number }
type NavGroup = { label: string; ids: ProcurementView[] }

const navGroups: NavGroup[] = [
  { label: "Pengadaan", ids: ["review", "master", "documents", "pics"] },
  { label: "Vendor", ids: ["vendors", "vendor_management", "tender"] },
  { label: "Sistem", ids: ["admins", "settings"] },
]

export function ProcurementSidebar({ view, setView, navItems, auth }: { view: ProcurementView; setView: (view: ProcurementView) => void; navItems: ProcurementNavItem[]; auth: AuthenticatedProcurement }) {
  const { isMobile, setOpenMobile, state, setOpen } = useSidebar()
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => Object.fromEntries(navGroups.map((group) => [group.label, group.ids.includes(view)])))
  const dashboard = navItems.find((item) => item.id === "dashboard")

  const selectView = (next: ProcurementView) => {
    setView(next)
    if (isMobile) setOpenMobile(false)
  }

  return <Sidebar collapsible="icon" className="border-r border-[#214f7d] bg-[#082f63]">
    <SidebarHeader className="border-b border-white/10 px-3 py-3 group-data-[collapsible=icon]:px-2"><NanoBrand /></SidebarHeader>
    <SidebarContent className="bg-[#082f63] px-2 py-4">
      <SidebarGroup className="group-data-[collapsible=icon]:px-0">
        <SidebarGroupLabel className="text-[11px] uppercase tracking-[.16em] text-white/45">Workspace</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            {dashboard && <SidebarMenuItem><SidebarMenuButton isActive={view === dashboard.id} tooltip={dashboard.label} onClick={() => selectView(dashboard.id)} className="text-white/75 hover:bg-white/10 hover:text-white data-[active=true]:bg-[#73d94b] data-[active=true]:font-semibold data-[active=true]:text-[#082f63]"><dashboard.icon /><span>{dashboard.label}</span></SidebarMenuButton></SidebarMenuItem>}
            {navGroups.map((group) => {
              const items = group.ids.map((id) => navItems.find((item) => item.id === id)).filter((item): item is ProcurementNavItem => Boolean(item))
              const active = items.some((item) => item.id === view)
              const GroupIcon = items[0]?.icon
              if (!items.length || !GroupIcon) return null
              return <Collapsible key={group.label} open={active || Boolean(openGroups[group.label])} onOpenChange={(open) => setOpenGroups((current) => ({ ...current, [group.label]: open }))} asChild>
                <SidebarMenuItem className="group/collapsible">
                  <CollapsibleTrigger asChild><SidebarMenuButton tooltip={group.label} onClick={() => { if (state === "collapsed") setOpen(true) }} className={`${active ? "bg-white/10 font-semibold text-white" : "text-white/75 hover:bg-white/10 hover:text-white"} h-8 text-sm [&>svg]:size-4`}><GroupIcon /><span className="truncate">{group.label}</span><ChevronDown className="ml-auto shrink-0 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-180" /></SidebarMenuButton></CollapsibleTrigger>
                  <CollapsibleContent><SidebarMenuSub>{items.map((item) => <SidebarMenuSubItem key={item.id}><SidebarMenuSubButton href="#" isActive={view === item.id} onClick={(event) => { event.preventDefault(); selectView(item.id) }} className="h-8 min-w-0 gap-2 pr-5 text-sm text-white/65 hover:bg-white/10 hover:text-white data-[active=true]:bg-[#73d94b] data-[active=true]:font-semibold data-[active=true]:text-[#082f63]"><item.icon className="size-4 shrink-0" /><span className="min-w-0 flex-1 truncate">{item.label}</span></SidebarMenuSubButton>{Boolean(item.badge) && <span aria-label={`${item.badge} notifikasi`} className="pointer-events-none absolute right-1 top-1/2 size-2 -translate-y-1/2 rounded-full bg-rose-500 ring-2 ring-[#082f63]" />}</SidebarMenuSubItem>)}</SidebarMenuSub></CollapsibleContent>
                  {Boolean(items.reduce((total, item) => total + (item.badge || 0), 0)) && <span aria-label="Ada notifikasi baru" className="pointer-events-none absolute right-0.5 top-0.5 size-2.5 rounded-full bg-rose-500 ring-2 ring-[#082f63]" />}
                </SidebarMenuItem>
              </Collapsible>
            })}
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
    <SidebarFooter className="border-t border-white/10 bg-[#082f63] p-3 group-data-[collapsible=icon]:p-2">
      <div className="flex min-w-0 items-center gap-3 rounded-xl bg-white/7 p-2 text-white group-data-[collapsible=icon]:hidden"><ProfileAvatar auth={auth} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{auth.session.name}</p><p className="truncate text-[11px] text-white/55">Procurement Admin</p></div><Button size="icon-sm" variant="ghost" title="Keluar" className="shrink-0 text-white/60 hover:bg-white/10 hover:text-white" onClick={auth.logout}><LogOut /></Button></div>
      <DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="mx-auto hidden size-12 place-items-center rounded-xl bg-white/8 outline-none ring-[#73d94b] hover:bg-white/14 focus-visible:ring-2 group-data-[collapsible=icon]:grid" aria-label={`Profil ${auth.session.name}`}><ProfileAvatar auth={auth} compact /></button></DropdownMenuTrigger><DropdownMenuContent side="right" align="end" className="w-56"><DropdownMenuLabel><span className="block truncate">{auth.session.name}</span><span className="block truncate text-xs font-normal text-muted-foreground">{auth.session.email}</span></DropdownMenuLabel><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={auth.logout}><LogOut />Keluar</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </SidebarFooter>
  </Sidebar>
}

function ProfileAvatar({ auth, compact = false }: { auth: AuthenticatedProcurement; compact?: boolean }) {
  const size = compact ? "size-9" : "size-9"
  return auth.session.picture ? <Image src={auth.session.picture} alt={auth.session.name} width={36} height={36} unoptimized className={`${size} shrink-0 rounded-full object-cover`} referrerPolicy="no-referrer" /> : <div className={`grid ${size} shrink-0 place-items-center rounded-full bg-[#73d94b] font-bold text-[#082f63]`}>{auth.session.name.slice(0, 1).toUpperCase()}</div>
}

export function ProcurementSidebarToggle() {
  const { state, isMobile, toggleSidebar } = useSidebar()
  const expanded = state === "expanded"
  const label = isMobile ? "Buka menu" : expanded ? "Tutup sidebar" : "Buka sidebar"
  const Icon = expanded && !isMobile ? PanelLeftClose : PanelLeftOpen
  return <Button type="button" variant="outline" size="sm" onClick={toggleSidebar} title={`${label} (Ctrl+B)`} aria-label={label} className="h-9 shrink-0 gap-2 border-blue-100 bg-white px-2.5 text-[#082f63] shadow-sm hover:bg-blue-50"><Icon className="size-4" /><span className="hidden text-xs font-semibold xl:inline">{expanded && !isMobile ? "Collapse" : "Menu"}</span></Button>
}

function NanoBrand() {
  return <div className="flex h-14 items-center gap-3 overflow-hidden group-data-[collapsible=icon]:justify-center">
    <Image src="/brand/nanobank-mark.png" alt="NanoBank Syariah" width={46} height={46} priority unoptimized className="size-11 shrink-0 rounded-[14px] object-contain shadow-sm" />
    <div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="whitespace-nowrap text-[15px] font-bold leading-tight text-white">Procurement Dashboard</p><p className="mt-1 text-[10px] font-medium uppercase tracking-[.18em] text-[#8fe768]">Control Center</p></div>
  </div>
}
