import assert from "node:assert";
import type { SupabaseClient } from "@supabase/supabase-js";
import { fake } from "../../../../test/support/fake.ts";
import { SupabaseAvatarStorage } from "./supabase-avatar-storage.ts";

function buildStorage({ signError = null as Error | null } = {}) {
  const calls: { bucket: string; path: string }[] = [];
  const client = fake<SupabaseClient>({
    storage: {
      from: (bucket: string) => ({
        createSignedUploadUrl: async (path: string) => {
          calls.push({ bucket, path });
          if (signError) {
            return { data: null, error: signError };
          }
          return { data: { signedUrl: `https://x.supabase.co/sign/${path}?token=abc`, token: "abc", path }, error: null };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://x.supabase.co/public/${bucket}/${path}` } }),
      }),
    },
  } as unknown as Partial<SupabaseClient>);
  return { storage: new SupabaseAvatarStorage({ client, bucket: "avatars" }), calls };
}

describe("SupabaseAvatarStorage", () => {
  it("asks Supabase for a signed upload url in the avatars bucket", async () => {
    const { storage, calls } = buildStorage();

    const upload = await storage.createUploadUrl({ path: "user/photo.jpg" });

    assert.deepStrictEqual(calls, [{ bucket: "avatars", path: "user/photo.jpg" }]);
    assert.deepStrictEqual(upload, { uploadUrl: "https://x.supabase.co/sign/user/photo.jpg?token=abc", token: "abc" });
  });

  it("builds the public url of a photo", () => {
    const { storage } = buildStorage();

    assert.strictEqual(storage.publicUrl({ path: "user/photo.jpg" }), "https://x.supabase.co/public/avatars/user/photo.jpg");
  });

  it("fails when Supabase refuses to sign the url", async () => {
    const { storage } = buildStorage({ signError: new Error("bucket not found") });

    await assert.rejects(storage.createUploadUrl({ path: "user/photo.jpg" }), /bucket not found/);
  });
});
