declare module "next-auth" {
  interface Session {
    hasYoutubeAccess: boolean;
    accessToken?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    access_token?: string;
    refresh_token?: string;
    expires_at?: number;
  }
}

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

const allowedEmails = (process.env.ALLOWED_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/youtube.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  pages: {
    signIn: "/signin",
  },
  trustHost: true,
  callbacks: {
    signIn({ profile }) {
      if (!allowedEmails.length) return true;
      const email = profile?.email?.toLowerCase();
      return !!email && allowedEmails.includes(email);
    },
    async jwt({ token, account }) {
      if (account) {
        token.access_token = account.access_token;
        token.refresh_token = account.refresh_token;
        token.expires_at = account.expires_at;
        return token;
      }

      const expiresAt = token.expires_at ?? 0;
      if (Date.now() < expiresAt * 1000) return token;

      const refreshToken = token.refresh_token;
      if (!refreshToken) return token;

      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: process.env.AUTH_GOOGLE_ID!,
            client_secret: process.env.AUTH_GOOGLE_SECRET!,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "refresh failed");

        token.access_token = data.access_token;
        token.expires_at = Math.floor(Date.now() / 1000) + data.expires_in;
        if (data.refresh_token) token.refresh_token = data.refresh_token;
      } catch (err) {
        console.error("[auth] token refresh failed:", err);
      }

      return token;
    },
    session({ session, token }) {
      return {
        ...session,
        hasYoutubeAccess: !!token.access_token,
        accessToken: token.access_token,
      };
    },
  },
});
