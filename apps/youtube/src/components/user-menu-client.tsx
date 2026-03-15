"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@data-projects/ui";
import { LogOut, Settings } from "lucide-react";
import Image from "next/image";

interface UserMenuClientProps {
  name?: string;
  email?: string;
  image?: string;
  signOutAction: () => Promise<void>;
}

export function UserMenuClient({ name, email, image, signOutAction }: Readonly<UserMenuClientProps>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="rounded-full ring-2 ring-transparent hover:ring-primary/40 transition-all focus-visible:outline-none focus-visible:ring-primary/60"
          title={name ?? "Account"}
          aria-label={name ?? "Account menu"}
          aria-haspopup="true"
        >
          {image ? (
            <Image
              src={image}
              alt={name ?? "User avatar"}
              width={32}
              height={32}
              className="rounded-full"
              style={{ width: 32, height: "auto" }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
              {name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="p-3 border-b border-border/50">
          {name && <p className="text-sm font-medium truncate">{name}</p>}
          {email && <p className="text-xs text-muted-foreground truncate">{email}</p>}
        </div>
        <div className="p-1 border-b border-border/50">
          <a
            href="/admin"
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <Settings className="h-4 w-4" />
            Admin
          </a>
        </div>
        <form action={signOutAction} className="p-1">
          <button
            type="submit"
            className="w-full flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </PopoverContent>
    </Popover>
  );
}
