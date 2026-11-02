import type { AvatarStorage, AvatarUpload } from "../../src/modules/profile/avatar-storage/avatar-storage.ts";

export class FakeAvatarStorage implements AvatarStorage {
  readonly signedPaths: string[] = [];

  async createUploadUrl({ path }: { path: string }): Promise<AvatarUpload> {
    this.signedPaths.push(path);
    return { uploadUrl: `https://storage.example.com/upload/${path}`, token: "upload-token" };
  }

  publicUrl({ path }: { path: string }): string {
    return `https://storage.example.com/public/${path}`;
  }
}
