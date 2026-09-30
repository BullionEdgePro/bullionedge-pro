import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-sans font-semibold transition-[background-color,color,box-shadow,transform] duration-200 ease-(--ease-vault) disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-[1.1em] [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        /** Signature CTA — the only button with the real gold gradient. */
        primary:
          "bg-gold-metal text-velvet shadow-[inset_0_1px_0_rgb(255_255_255/0.45),0_1px_2px_rgb(var(--shadow)/0.25),0_8px_24px_-12px_#A8823F] hover:brightness-[1.06] hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.5),0_1px_2px_rgb(var(--shadow)/0.25),0_14px_32px_-12px_#A8823F]",
        /** Flat gold outline for secondary actions. */
        secondary:
          "border border-gold-large/70 text-gold hover:bg-gold-tint hover:border-gold-large",
        /** Solid ink / mist — neutral strong action (e.g. forms, checkout steps). */
        solid: "bg-fg text-bg hover:opacity-90",
        ghost: "text-fg hover:bg-surface-sunk",
        quiet: "text-gold underline-offset-4 hover:underline px-0!",
        danger: "bg-danger text-bg hover:opacity-90",
      },
      size: {
        sm: "h-9 rounded-md px-3.5 text-sm",
        md: "h-11 rounded-lg px-5 text-[0.95rem]",
        lg: "h-14 rounded-xl px-7 text-base",
        icon: "size-11 rounded-lg",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ComponentProps<"button">, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
