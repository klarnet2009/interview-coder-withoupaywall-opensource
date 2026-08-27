import * as React from "react"
import * as ToastPrimitive from "@radix-ui/react-toast"
import { cn } from "../../lib/utils"
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react"

const ToastProvider = ToastPrimitive.Provider

export type ToastMessage = {
  title: string
  description: string
  variant: ToastVariant
}

const ToastViewport = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 right-0 z-[100] flex max-h-screen w-full flex-col-reverse gap-2 p-3 sm:top-0 sm:right-0 sm:flex-col md:max-w-[340px]",
      className
    )}
    {...props}
  />
))
ToastViewport.displayName = ToastPrimitive.Viewport.displayName

type ToastVariant = "neutral" | "success" | "error"

interface ToastProps
  extends React.ComponentPropsWithoutRef<typeof ToastPrimitive.Root> {
  variant?: ToastVariant
  swipeDirection?: "right" | "left" | "up" | "down"
}

const toastVariants: Record<
  ToastVariant,
  { icon: React.ReactNode }
> = {
  neutral: {
    icon: <Info className="h-4 w-4 text-zinc-400 shrink-0" />
  },
  success: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
  },
  error: {
    icon: <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
  }
}

const Toast = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Root>,
  ToastProps
>(({ className, variant = "neutral", duration = 4500, ...props }, ref) => (
  <ToastPrimitive.Root
    ref={ref}
    duration={duration}
    className={cn(
      "group pointer-events-auto relative flex w-full items-start space-x-2.5 overflow-hidden rounded-xl border p-3 shadow-2xl backdrop-blur-md transition-all",
      "bg-zinc-900 border-zinc-700 text-zinc-100",
      className
    )}
    {...props}
  >
    <div className="mt-0.5">{toastVariants[variant].icon}</div>
    <div className="flex-1 min-w-0 pr-4">{props.children}</div>
    <ToastPrimitive.Close className="absolute right-2 top-2 rounded-md p-1 text-zinc-400 opacity-70 transition-opacity hover:text-zinc-100 hover:opacity-100">
      <X className="h-3 w-3" />
    </ToastPrimitive.Close>
  </ToastPrimitive.Root>
))
Toast.displayName = ToastPrimitive.Root.displayName

const ToastAction = React.forwardRef<
  React.ElementRef<typeof ToastPrimitive.Action>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Action>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Action
    ref={ref}
    className={cn(
      "text-[0.7rem] font-medium text-zinc-400 hover:text-zinc-100",
      className
    )}
    {...props}
  />
))
ToastAction.displayName = ToastPrimitive.Action.displayName

const ToastTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-xs font-semibold text-zinc-100 leading-tight", className)}
    {...props}
  />
))
ToastTitle.displayName = "ToastTitle"

const ToastDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-[11px] text-zinc-300 mt-0.5 leading-snug break-words", className)}
    {...props}
  />
))
ToastDescription.displayName = "ToastDescription"

export type { ToastProps, ToastVariant }
export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastAction,
  ToastTitle,
  ToastDescription
}
