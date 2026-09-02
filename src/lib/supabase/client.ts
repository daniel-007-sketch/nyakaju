"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getPublicSupabaseEnvironment } from "@/lib/supabase/env";
import type { Database } from "@/types/database";

let browserClient: SupabaseClient<Database> | undefined;

export function createClient() {
  if (!browserClient) {
    const { url, publishableKey } = getPublicSupabaseEnvironment();
    browserClient = createBrowserClient<Database>(url, publishableKey);
  }

  return browserClient;
}
