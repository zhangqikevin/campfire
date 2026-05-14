import type { NextAuthConfig } from "next-auth";

// Edge-safe config: no providers, no DB, no bcryptjs imports. Used by
// middleware (which runs in the Edge runtime) and re-exported from auth.ts
// alongside the full Credentials provider.
//
// The split keeps Node-only deps (pg, bcryptjs) out of the Edge bundle, which
// would otherwise fail to compile or balloon the middleware size.
export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isAuthed = !!auth?.user;
      const path = nextUrl.pathname;
      const role = auth?.user?.role;

      // Deny-by-default: explicit public allowlist, everything else needs auth.
      // New app routes are protected without anyone remembering to update this.
      const isPublic =
        path === "/" ||
        path === "/login" ||
        path.startsWith("/api/auth/");

      if (!isPublic && !isAuthed) {
        const target = new URL("/login", nextUrl);
        target.searchParams.set("from", path);
        return Response.redirect(target);
      }

      // /admin/* requires the `admin` role. Defense-in-depth — server actions
      // and pages also call requireAdminId(), but blocking at the middleware
      // layer means a member can't even GET /admin/anything.
      if (path.startsWith("/admin") && isAuthed && role !== "admin") {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      if (path === "/login" && isAuthed) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token["userId"] = user.id ?? "";
        token["tenantId"] = user.tenantId ?? "";
        token["role"] = user.role ?? "member";
      }
      return token;
    },
    session({ session, token }) {
      const userId = typeof token["userId"] === "string" ? token["userId"] : "";
      const tenantId = typeof token["tenantId"] === "string" ? token["tenantId"] : "";
      const role = token["role"] === "admin" ? "admin" : "member";
      if (userId) session.user.id = userId;
      if (tenantId) session.user.tenantId = tenantId;
      session.user.role = role;
      return session;
    },
  },
};
