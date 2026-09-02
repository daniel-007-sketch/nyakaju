import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//")
    ? next
    : "/admin-dashboard";

  if (!code) {
    return NextResponse.redirect(
      new URL("/admin-login?error=missing_code", requestUrl.origin),
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL("/admin-login?error=invalid_link", requestUrl.origin),
    );
  }

  const { data } = await supabase.auth.getClaims();
  if (data?.claims?.app_metadata?.role !== "admin") {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/admin-login?error=unauthorized", requestUrl.origin),
    );
  }

  return NextResponse.redirect(new URL(safeNext, requestUrl.origin));
}
