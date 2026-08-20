"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSignInHref } from "./auth-required";

export function SignInButton() {
  const pathname = usePathname();
  const href = useSignInHref();
  if (pathname === "/signin") return null;

  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-all hover:border-border hover:bg-muted/80 hover:text-foreground"
    >
      <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
      Sign in
    </Link>
  );
}
