import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../../../common/env/env.ts";
import type { AvatarStorage, AvatarUpload } from "./avatar-storage.ts";

interface SupabaseAvatarStorageInput {
  client: SupabaseClient;
  bucket: string;
}

interface CreateSupabaseAvatarStorageInput {
  env: Env;
}

export class SupabaseAvatarStorage implements AvatarStorage {
  private readonly client: SupabaseClient;
  private readonly bucket: string;

  constructor({ client, bucket }: SupabaseAvatarStorageInput) {
    this.client = client;
    this.bucket = bucket;
  }

  async createUploadUrl({ path }: { path: string }): Promise<AvatarUpload> {
    const { data, error } = await this.client.storage.from(this.bucket).createSignedUploadUrl(path);
    if (error) {
      throw error;
    }
    return { uploadUrl: data.signedUrl, token: data.token };
  }

  publicUrl({ path }: { path: string }): string {
    return this.client.storage.from(this.bucket).getPublicUrl(path).data.publicUrl;
  }
}

export function createSupabaseAvatarStorage({ env }: CreateSupabaseAvatarStorageInput): SupabaseAvatarStorage {
  const client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return new SupabaseAvatarStorage({ client, bucket: env.SUPABASE_AVATAR_BUCKET });
}
