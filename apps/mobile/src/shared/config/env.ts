function requiredEnv(name: string, value: string | undefined) {
  if (!value) {
    throw new Error(`Defina ${name} no .env.local do app`);
  }
  return value;
}

export const SERVER_URL = requiredEnv("EXPO_PUBLIC_SERVER_URL", process.env.EXPO_PUBLIC_SERVER_URL);
export const API_URL = requiredEnv("EXPO_PUBLIC_API_URL", process.env.EXPO_PUBLIC_API_URL);
export const SUPABASE_URL = requiredEnv("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL);
export const SUPABASE_ANON_KEY = requiredEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY);
