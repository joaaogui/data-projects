import { YouTubeIcon } from "@/components/youtube-icon";
import { signIn } from "@/lib/auth";
import { ThemeToggle } from "@data-projects/ui";
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false, follow: false },
};

function GoogleIcon({ className }: Readonly<{ className?: string }>) {
  return (
    <svg className={className} viewBox="0 0 24 24">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

export default async function SignInPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ callbackUrl?: string }>;
}>) {
  const { callbackUrl } = await searchParams;
  const redirectTo = callbackUrl || "/";

  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="fixed right-4 top-4 z-[60]">
        <ThemeToggle iconClassName="text-primary" />
      </div>

      <div className="relative z-10 mx-4 w-full max-w-sm animate-fade-up">
        <div className="space-y-8">
          <div className="space-y-3">
            <YouTubeIcon className="h-8 w-8 text-foreground" />
            <h1 className="text-2xl font-medium tracking-tight">Sign in</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Analyze new channels, track them, and ask AI about their catalog.
            </p>
          </div>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo });
            }}
          >
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
            >
              <GoogleIcon className="h-4 w-4" />
              Continue with Google
            </button>
          </form>

          <p className="border-t border-border pt-6 text-sm text-muted-foreground">
            <Link href="/" className="text-foreground underline underline-offset-4 hover:no-underline">
              Continue without an account
            </Link>{" "}
            to search and read any analyzed channel.
          </p>
        </div>
      </div>
    </div>
  );
}
