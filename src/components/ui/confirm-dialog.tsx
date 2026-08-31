import * as React from "react"
import { useTranslation } from "react-i18next"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "./dialog"
import { cn } from "../../lib/utils"

interface ConfirmDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description: string
    confirmLabel: string
    onConfirm: () => void
    /** Red confirm button. Defaults to true — every current caller is destructive. */
    destructive?: boolean
}

const KBD_CLASS = "bg-white/6 border border-white/8 rounded px-1.5 py-0.5 text-[11px] font-mono"

/**
 * Confirmation gate for irreversible actions.
 *
 * Built on the existing Radix dialog primitives, which already own the portal,
 * overlay, centering and z-50 stacking — this adds only the two-button footer
 * and the keyboard contract:
 *
 *   Escape → cancel (Radix routes this to onOpenChange)
 *   Enter  → confirm
 *   focus starts on Cancel, so a stray Space or click is harmless
 *
 * Because Enter confirms while the focus ring rests on Cancel, the mapping is
 * rendered as visible key hints rather than left to inference.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
    open,
    onOpenChange,
    title,
    description,
    confirmLabel,
    onConfirm,
    destructive = true
}) => {
    const { t } = useTranslation()
    const cancelRef = React.useRef<HTMLButtonElement>(null)

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing) return
        // preventDefault first: without it the focused Cancel button would also
        // activate on Enter and race the confirmation.
        event.preventDefault()
        event.stopPropagation()
        onConfirm()
        onOpenChange(false)
    }

    const handleOpenAutoFocus = (event: Event) => {
        event.preventDefault()
        cancelRef.current?.focus()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                onKeyDown={handleKeyDown}
                onOpenAutoFocus={handleOpenAutoFocus}
                className="max-w-sm"
            >
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="gap-2 sm:gap-0">
                    <button
                        ref={cancelRef}
                        type="button"
                        onClick={() => onOpenChange(false)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs text-white/50 hover:text-white/80 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                        {t("confirm.cancel")}
                        <kbd className={cn(KBD_CLASS, "text-white/50")}>{t("confirm.keyEscape")}</kbd>
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            onConfirm()
                            onOpenChange(false)
                        }}
                        className={cn(
                            "inline-flex items-center gap-2 px-4 py-1.5 text-xs font-medium rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                            destructive
                                ? "bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25"
                                : "bg-white text-black hover:bg-white/90"
                        )}
                    >
                        {confirmLabel}
                        <kbd className={cn(KBD_CLASS, destructive ? "text-red-200/70" : "text-black/50")}>
                            {t("confirm.keyEnter")}
                        </kbd>
                    </button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

export default ConfirmDialog
