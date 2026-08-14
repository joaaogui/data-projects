"use client";

import { LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SignInButton() {
  const pathname = usePathname();
  if (pathname === "/signin") return null;

  const href = `/signin?callbackUrl=${encodeURIComponent(pathname || "/")}`;

  return (
    <Link
      href={href}
      className="flex items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-all hover:border-border hover:bg-muted/80 hover:text-foreground"
    >
      <LogIn className="h-3.5 w-3.5" />
      Sign in
    </Link>
  );
}
