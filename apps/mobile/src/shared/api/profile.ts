import { queryOptions } from "@tanstack/react-query";
import type { PhotoUploadBody, PhotoUploadResponse, ProfileResponse, RegistrationBody, UpdateProfileBody } from "@pontinho/api-contract";
import { request } from "./client";

export function profileQueryOptions() {
  return queryOptions({
    queryKey: ["profile"],
    queryFn: () => request<ProfileResponse>("/profile"),
  });
}

export function register(body: RegistrationBody) {
  return request<ProfileResponse>("/profile/registration", { method: "POST", body });
}

export function updateProfile(body: UpdateProfileBody) {
  return request<ProfileResponse>("/profile", { method: "PATCH", body });
}

export function requestPhotoUpload(body: PhotoUploadBody) {
  return request<PhotoUploadResponse>("/profile/photo-upload", { method: "POST", body });
}

export function deleteAccount() {
  return request<void>("/profile", { method: "DELETE" });
}
