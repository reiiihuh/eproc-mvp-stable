"use client"

import { useState } from "react"
import { CalendarIcon } from "lucide-react"
import { id as locale } from "date-fns/locale"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { formatIndonesianDate } from "@/lib/indonesian-date"
import { cn } from "@/lib/utils"

const localDate = (value: string) => new Date(`${value}T12:00:00`)

export function DateInput({ value, onChange, min, max, disabled, className, "aria-label": label }: {
  value: string; onChange: (value: string) => void; min?: string; max?: string; disabled?: boolean; className?: string; "aria-label"?: string
}) {
  const [open, setOpen] = useState(false)
  const selected = value ? localDate(value) : undefined
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><button type="button" disabled={disabled} aria-label={label} className={cn("flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-left text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50", className)}>
      <span className={value ? "" : "text-muted-foreground"}>{formatIndonesianDate(value) || "Pilih tanggal"}</span><CalendarIcon className="size-4" />
    </button></PopoverTrigger>
    <PopoverContent align="start" className="w-auto p-2">
      <Calendar mode="single" locale={locale} formatters={{ formatMonthDropdown: date => date.toLocaleString("id-ID", { month: "long" }) }} captionLayout="dropdown" selected={selected} defaultMonth={selected} startMonth={new Date(1900, 0)} endMonth={new Date(2100, 11)} disabled={[...(min ? [{ before: localDate(min) }] : []), ...(max ? [{ after: localDate(max) }] : [])]} onSelect={date => {
        onChange(date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : "")
        setOpen(false)
      }} />
      <button type="button" className="w-full rounded-md p-2 text-sm hover:bg-accent" onClick={() => { onChange(""); setOpen(false) }}>Kosongkan tanggal</button>
    </PopoverContent>
  </Popover>
}
