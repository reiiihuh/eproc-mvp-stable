"use client"

import { Check, LoaderCircle } from "lucide-react"

import { AlertDialog, AlertDialogAction, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Progress } from "@/components/ui/progress"
import type { OperationState } from "@/components/procurement/procurement-ui-types"

export function OperationDialog({ operation, close }: { operation: OperationState; close: () => void }) {
  const progress = Math.round((operation.step / Math.max(operation.total, 1)) * 100)
  return <AlertDialog open={operation.open} onOpenChange={(open) => { if (!open && operation.state !== "working") close() }}><AlertDialogContent><AlertDialogHeader><div className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-blue-50">{operation.state === "working" ? <LoaderCircle className="size-5 animate-spin text-[#2075b8]" /> : operation.state === "success" ? <Check className="size-5 text-emerald-600" /> : <span className="text-lg font-bold text-rose-600">!</span>}</div><AlertDialogTitle>{operation.title}</AlertDialogTitle><AlertDialogDescription>{operation.message}</AlertDialogDescription></AlertDialogHeader><Progress value={progress} className="h-2" />{operation.state !== "working" && <AlertDialogFooter><AlertDialogAction onClick={close}>{operation.state === "success" ? "Selesai" : "Tutup"}</AlertDialogAction></AlertDialogFooter>}</AlertDialogContent></AlertDialog>
}
