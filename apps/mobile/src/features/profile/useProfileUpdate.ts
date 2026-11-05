import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { AVATAR_CONTENT_TYPES, type ProfileResponse, type UpdateProfileBody } from "@pontinho/api-contract";
import { profileQueryOptions, requestPhotoUpload, updateProfile } from "@/shared/api/profile";
import profileMessages from "@/messages/profile.json";

type Photo = ImagePicker.ImagePickerAsset;

function toAvatarContentType(mimeType?: string | null) {
  return AVATAR_CONTENT_TYPES.find((contentType) => contentType === mimeType);
}

type FileUpload = { uri: string; uploadUrl: string; contentType: string };

async function sendFile({ uri, uploadUrl, contentType }: FileUpload) {
  try {
    const file = await (await fetch(uri)).blob();
    const response = await fetch(uploadUrl, { method: "PUT", headers: { "Content-Type": contentType }, body: file });
    return response.ok;
  } catch {
    return false;
  }
}

async function changePhoto(photo: Photo) {
  const contentType = toAvatarContentType(photo.mimeType);
  if (!contentType) {
    throw new Error(profileMessages.invalidPhotoType);
  }
  const { path, uploadUrl } = await requestPhotoUpload({ contentType });
  const uploaded = await sendFile({ uri: photo.uri, uploadUrl, contentType });
  if (!uploaded) {
    throw new Error(profileMessages.photoUploadFailed);
  }
  return updateProfile({ photoPath: path });
}

export function useProfileUpdate({ onSaved }: { onSaved: () => void }) {
  const queryClient = useQueryClient();
  const keep = (profile: ProfileResponse) => {
    queryClient.setQueryData(profileQueryOptions().queryKey, profile);
    onSaved();
  };
  const fields = useMutation({ mutationFn: updateProfile, onSuccess: keep });
  const photo = useMutation({ mutationFn: changePhoto, onSuccess: keep });

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (result.canceled) {
      return;
    }
    photo.mutate(result.assets[0]);
  }

  function reset() {
    fields.reset();
    photo.reset();
  }

  return {
    save: (body: UpdateProfileBody) => fields.mutate(body),
    pickPhoto,
    saving: fields.isPending || photo.isPending,
    error: fields.error?.message ?? photo.error?.message ?? "",
    reset,
  };
}
