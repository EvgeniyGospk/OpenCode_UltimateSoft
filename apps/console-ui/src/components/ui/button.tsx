import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent-hover)] focus-visible:ring-[var(--color-accent-hover)]",
        secondary:
          "border border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-panel)] focus-visible:ring-slate-400",
        ghost:
          "text-[var(--color-muted)] hover:bg-[var(--color-panel)] hover:text-[var(--color-ink)] focus-visible:ring-slate-400",
        danger:
          "bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger-hover)] focus-visible:ring-[var(--color-danger)]"
      },
      size: {
        md: "h-10 px-4 text-sm",
        sm: "h-8 px-3 text-xs",
        icon: "h-10 w-10"
      }
    },
    defaultVariants: {
      variant: "secondary",
      size: "md"
    }
  }
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({
  asChild,
  className,
  variant,
  size,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";

  return (
    <Comp
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
