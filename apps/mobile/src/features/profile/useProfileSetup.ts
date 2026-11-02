import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { AVATAR_CONTENT_TYPES } from "@pontinho/api-contract";
import { profileQueryOptions, requestPhotoUpload, saveProfile } from "@/shared/api/profile";
import profileMessages from "@/messages/profile.json";
import { formatBirthDateInput, toIsoDate } from "./birthDate";

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

async function uploadPhoto(photo: Photo) {
  const contentType = toAvatarContentType(photo.mimeType);
  if (!contentType) {
    throw new Error(profileMessages.invalidPhotoType);
  }
  const { path, uploadUrl } = await requestPhotoUpload({ contentType });
  const uploaded = await sendFile({ uri: photo.uri, uploadUrl, contentType });
  if (!uploaded) {
    throw new Error(profileMessages.photoUploadFailed);
  }
  return path;
}

type SaveInput = { name: string; birthDate: string; photo?: Photo };

function profileError({ invalidPhoto, saveError }: { invalidPhoto: boolean; saveError: Error | null }) {
  if (invalidPhoto) {
    return profileMessages.invalidPhotoType;
  }
  return saveError?.message ?? "";
}

async function saveProfileWithPhoto({ name, birthDate, photo }: SaveInput) {
  if (!photo) {
    return saveProfile({ name, birthDate });
  }
  const photoPath = await uploadPhoto(photo);
  return saveProfile({ name, birthDate, photoPath });
}

export function useProfileSetup() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [birthDateText, setBirthDateText] = useState("");
  const [photo, setPhoto] = useState<Photo>();
  const save = useMutation({
    mutationFn: saveProfileWithPhoto,
    onSuccess: (profile) => queryClient.setQueryData(profileQueryOptions().queryKey, profile),
  });

  const birthDate = toIsoDate(birthDateText);
  const invalidPhoto = photo !== undefined && toAvatarContentType(photo.mimeType) === undefined;
  const canSave = name.trim().length > 0 && birthDate !== undefined && !invalidPhoto;

  async function pickPhoto() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) {
      return;
    }
    setPhoto(result.assets[0]);
  }

  function submit() {
    if (!canSave || birthDate === undefined) {
      return;
    }
    save.mutate({ name: name.trim(), birthDate, photo });
  }

  return {
    name,
    setName,
    birthDateText,
    changeBirthDate: (text: string) => setBirthDateText(formatBirthDateInput(text)),
    photoUri: photo?.uri,
    pickPhoto,
    canSave,
    saving: save.isPending,
    error: profileError({ invalidPhoto, saveError: save.error }),
    submit,
  };
}
