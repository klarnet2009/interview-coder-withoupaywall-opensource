import React from "react"
import { ShieldAlert } from "lucide-react"
import type { ActionNotice } from "./types"

interface ActionNoticeBannerProps {
  notice: ActionNotice
  onPrimary: () => void | Promise<void>
  onSecondary: () => void | Promise<void>
  onDismiss: () => void
}

export const ActionNoticeBanner: React.FC<ActionNoticeBannerProps> = ({
  notice,
  onPrimary,
  onSecondary,
  onDismiss
}) => {
  return (
    <div className="mx-3 mt-3 p-3 rounded-lg border border-amber-400/35 bg-amber-500/10 text-amber-100 functional-enter">
      <div className="flex items-start gap-2">
        <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold">{notice.title}</div>
          <div className="text-[12px] text-amber-100/85 mt-0.5">
            {notice.message}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={onPrimary}
              className="h-8 px-3 rounded-md border border-amber-300/45 bg-amber-500/20 text-[12px] font-medium hover:bg-amber-500/30 transition-colors"
            >
              {notice.primaryLabel}
            </button>
            {notice.secondaryLabel && (
              <button
                onClick={onSecondary}
                className="h-8 px-3 rounded-md border border-white/20 bg-white/5 text-[12px] text-white/85 hover:bg-white/10 transition-colors"
              >
                {notice.secondaryLabel}
              </button>
            )}
            <button
              onClick={onDismiss}
              className="h-8 px-3 rounded-md border border-white/20 bg-transparent text-[12px] text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
