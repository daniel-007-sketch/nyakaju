import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "local" });

  if (error) {
    console.error("Admin logout failed", error);
    return Response.json(
      { error: "The administrator session could not be closed." },
      { status: 500 },
    );
  }

  return Response.redirect(new URL("/admin-login", request.url), 303);
}
