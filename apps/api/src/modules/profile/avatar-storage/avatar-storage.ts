export interface AvatarUpload {
  uploadUrl: string;
  token: string;
}

interface AvatarPathInput {
  path: string;
}

export interface AvatarStorage {
  createUploadUrl(input: AvatarPathInput): Promise<AvatarUpload>;
  publicUrl(input: AvatarPathInput): string;
}
