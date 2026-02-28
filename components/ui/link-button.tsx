import Link from "next/link";
import { type AnchorHTMLAttributes } from "react";
import { type VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type LinkHref = string | URL | { pathname: string; query?: Record<string, string | number | boolean | null | undefined> };

type LinkButtonProps = {
  href: LinkHref;
  className?: string;
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href"> &
  VariantProps<typeof buttonVariants>;

export function LinkButton({ className, variant, size, ...props }: LinkButtonProps) {
  const { href, ...rest } = props;
  return <Link href={href as any} className={cn(buttonVariants({ variant, size, className }))} {...rest} />;
}
