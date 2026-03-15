import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { allowedEmails, env } from "./env";
import { createTaggedLogger } from "./logger";

const log = createTaggedLogger("auth");

interface OAuthToken {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  [key: string]: unknown;
}

declare module "next-auth" {
  interface Session {
    hasYoutubeAccess: boolean;
    accessToken?: string;
  }
}

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
      const t = token as OAuthToken;

      if (account) {
        t.access_token = account.access_token;
        t.refresh_token = account.refresh_token;
        t.expires_at = account.expires_at;
        return t;
      }

      const expiresAt = t.expires_at ?? 0;
      if (Date.now() < expiresAt * 1000) return t;

      const refreshToken = t.refresh_token;
      if (!refreshToken) return t;

      try {
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            client_id: env.AUTH_GOOGLE_ID,
            client_secret: env.AUTH_GOOGLE_SECRET,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
          }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "refresh failed");

        t.access_token = data.access_token;
        t.expires_at = Math.floor(Date.now() / 1000) + data.expires_in;
        if (data.refresh_token) t.refresh_token = data.refresh_token;
      } catch (err) {
        log.error({ err }, "Token refresh failed");
      }

      return t;
    },
    session({ session, token }) {
      const t = token as OAuthToken;
      return {
        ...session,
        hasYoutubeAccess: !!t.access_token,
        accessToken: t.access_token,
      };
    },
  },
});
