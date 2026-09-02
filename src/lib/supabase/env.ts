function requireEnvironmentValue(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getPublicSupabaseEnvironment() {
  return {
    url: requireEnvironmentValue(
      "NEXT_PUBLIC_SUPABASE_URL",
      process.env.NEXT_PUBLIC_SUPABASE_URL,
    ),
    publishableKey: requireEnvironmentValue(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    ),
  };
}

export function getServerSupabaseEnvironment() {
  return {
    url: requireEnvironmentValue("SUPABASE_URL", process.env.SUPABASE_URL),
    publishableKey: requireEnvironmentValue(
      "SUPABASE_PUBLISHABLE_KEY",
      process.env.SUPABASE_PUBLISHABLE_KEY,
    ),
    secretKey: requireEnvironmentValue(
      "SUPABASE_SECRET_KEY",
      process.env.SUPABASE_SECRET_KEY,
    ),
  };
}
