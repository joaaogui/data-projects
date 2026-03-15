import { auth, signOut } from "@/lib/auth";
import { UserMenuClient } from "./user-menu-client";

export async function UserMenu() {
  const session = await auth();
  if (!session?.user) return null;

  return (
    <UserMenuClient
      name={session.user.name ?? undefined}
      email={session.user.email ?? undefined}
      image={session.user.image ?? undefined}
      signOutAction={async () => {
        "use server";
        await signOut({ redirectTo: "/signin" });
      }}
    />
  );
}
