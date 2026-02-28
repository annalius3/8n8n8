import Link from "next/link";
import { type ComponentProps } from "react";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LinkButtonProps = Omit<ComponentProps<typeof Link>, "className"> &
  { className?: string } &
  VariantProps<typeof buttonVariants>;

export function LinkButton({ className, variant, size, ...props }: LinkButtonProps) {
  return <Link className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
