type SupabaseEnvironment = Partial<Record<string, string | undefined>>;

export function resolveSupabasePublicEnv(
  environment: SupabaseEnvironment = process.env,
) {
  return {
    url:
      environment.SUPABASE_URL ??
      environment.NEXT_PUBLIC_SUPABASE_URL,
    key:
      environment.SUPABASE_PUBLISHABLE_KEY ??
      environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

export function isSupabaseConfigured(
  environment: SupabaseEnvironment = process.env,
) {
  const { url, key } = resolveSupabasePublicEnv(environment);
  return Boolean(url && key);
}

export function requireSupabasePublicEnv() {
  const { url, key } = resolveSupabasePublicEnv();
  if (!url || !key) {
    throw new Error(
      "Supabase authentication is not configured for this environment.",
    );
  }
  return { url, key };
}
