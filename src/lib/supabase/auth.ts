import { createClient } from "@/lib/supabase/server";

export async function getAdminSession() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  const role = claims?.app_metadata?.role;

  if (error || !claims || role !== "admin") {
    return null;
  }

  return {
    supabase,
    claims,
  };
}

export async function requireAdminSession() {
  const session = await getAdminSession();

  if (!session) {
    return {
      session: null,
      response: Response.json(
        { error: "Administrator authentication is required." },
        { status: 401 },
      ),
    } as const;
  }

  return { session, response: null } as const;
}
