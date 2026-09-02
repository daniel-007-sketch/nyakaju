import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getPublicSupabaseEnvironment } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getPublicSupabaseEnvironment();

  const supabase = createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const isAdmin = data?.claims?.app_metadata?.role === "admin";

  if (request.nextUrl.pathname === "/admin-dashboard" && !isAdmin) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/admin-login";
    loginUrl.searchParams.set("next", "/admin-dashboard");
    return NextResponse.redirect(loginUrl);
  }

  if (request.nextUrl.pathname === "/admin-login" && isAdmin) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/admin-dashboard";
    dashboardUrl.search = "";
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
