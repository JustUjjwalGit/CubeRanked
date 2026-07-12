import { createClient } from "@supabase/supabase-js";
import type { AppEnv } from "../types/env.js";

let adminClient: ReturnType<typeof createClient> | null = null;

export function getSupabaseAdmin(env: AppEnv) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  if (!adminClient) {
    adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}

export interface SupabaseUserInfo {
  sub: string;
  email: string;
  userMetadata: Record<string, unknown>;
}

export async function verifySupabaseToken(env: AppEnv, token: string): Promise<SupabaseUserInfo | null> {
  const admin = getSupabaseAdmin(env);
  if (!admin) return null;

  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return null;

    return {
      sub: data.user.id,
      email: data.user.email ?? "",
      userMetadata: data.user.user_metadata ?? {},
    };
  } catch {
    return null;
  }
}
