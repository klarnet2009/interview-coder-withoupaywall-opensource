import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

/**
 * The app's button vocabulary.
 *
 * Every class below is compiled against this project's own `src/index.css` by
 * the no-op gate in `tests/unit/designSystem.test.ts`. That gate exists because
 * the previous, stock-shadcn definition of this file was inert: it keyed off
 * `bg-primary`, `bg-secondary`, `bg-destructive`, `bg-accent`, `border-input`
 * and `bg-background`, none of which this project's `@theme` declares, so
 * fourteen of its classes generated no rule at all. `<Button>` with default
 * props painted a bare `shadow` around no fill, no border and no text colour,
 * which is why all six call sites reconstructed the surface in `className`.
 *
 * The replacements are the measured vocabulary of the app's 164 buttons rather
 * than an invented palette: ghost is the most common surface (32 occurrences),
 * then secondary (18), outline (12) and the white fill (7). `destructive` is
 * copied verbatim from `confirm-dialog.tsx` — the app's danger idiom is a
 * red-tinted glass chip, not a saturated red fill. Sizes follow the same
 * census, where `rounded-lg` beats `rounded-md` and `h-8 px-3 py-1.5 text-xs`
 * is the dominant chip.
 *
 * White veils and text weights are written through the `--opacity-*` tokens so
 * the definitions read as intent. `bg-white/glass` and `bg-white/10` are proven
 * computed-equivalent by the equivalence gate, so the ~1,200 sites still on the
 * numeric form are aliases of these names rather than drift away from them.
 *
 * There are deliberately no `focus-visible:` classes here. The global
 * `*:focus-visible` rule in `src/index.css` is unlayered, so it outranks every
 * utility regardless of specificity; the shadcn ring this file used to carry
 * has been dead since quick-260831-xan and its removal is a cleanup, not a
 * regression. Keyboard focus on these buttons depends on that global rule
 * staying at brace depth zero.
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-white text-black hover:bg-white/solid-hover",
        destructive:
          "bg-red-500/15 text-red-300 border border-red-500/30 hover:bg-red-500/25",
        outline:
          "bg-transparent text-white border border-white/glass-hover hover:bg-white/glass-subtle",
        secondary:
          "bg-white/glass text-white hover:bg-white/glass-hover",
        ghost:
          "text-white/ink-secondary hover:text-white hover:bg-white/glass",
        link: "text-white/ink-secondary underline-offset-4 hover:underline hover:text-white"
      },
      size: {
        default: "h-8 px-3 py-1.5 text-xs",
        sm: "h-7 px-2.5 py-1 text-xs",
        lg: "h-10 px-6 py-2 text-sm",
        icon: "h-8 w-8 p-0"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
