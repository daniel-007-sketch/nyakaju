import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  return Response.json({
    ok: !error,
    authenticated: Boolean(data?.claims?.sub),
    isAdmin: data?.claims?.app_metadata?.role === "admin",
  });
}
