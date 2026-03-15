import { LazyWebGLBackground as WebGLBackground } from "@/components/webgl-background-lazy";
import { YouTubeIcon } from "@/components/youtube-icon";
import { signIn } from "@/lib/auth";
import { ThemeToggle } from "@data-projects/ui";
import type { Metadata } from "next";

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

export default function SignInPage() {
  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <WebGLBackground />
      <div className="fixed right-4 top-4 z-[60]">
        <ThemeToggle iconClassName="text-primary" />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-4 animate-scale-in">
        <div className="rounded-3xl border border-border/40 bg-card/80 backdrop-blur-2xl shadow-2xl p-8 space-y-8">
          <div className="space-y-3 text-center">
            <div className="flex justify-center animate-scale-in">
              <div className="rounded-2xl bg-foreground/5 p-3">
                <YouTubeIcon className="h-10 w-10 text-foreground" />
              </div>
            </div>
            <h1 className="text-2xl font-bold tracking-tight animate-fade-up" style={{ animationDelay: "80ms" }}>YouTube Analyzer</h1>
            <p className="text-sm text-muted-foreground animate-fade-up" style={{ animationDelay: "160ms" }}>
              Sign in to analyze channels, track engagement, and uncover video insights
            </p>
          </div>

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: "/" });
            }}
            className="animate-fade-up"
            style={{ animationDelay: "240ms" }}
          >
            <button
              type="submit"
              className="w-full flex items-center justify-center gap-3 rounded-xl border border-border/60 bg-background/80 px-4 py-3 text-sm font-medium transition-all hover:bg-muted/80 hover:border-border hover:shadow-lg active:scale-[0.97]"
            >
              <GoogleIcon className="h-5 w-5" />
              Continue with Google
            </button>
          </form>

          <p className="text-center text-[11px] text-muted-foreground/60 animate-fade-up" style={{ animationDelay: "320ms" }}>
            Sign in with your Google account to get started
          </p>
        </div>
      </div>
    </div>
  );
}
