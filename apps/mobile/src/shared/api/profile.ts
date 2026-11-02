import { queryOptions } from "@tanstack/react-query";
import type { PhotoUploadBody, PhotoUploadResponse, ProfileResponse, SaveProfileBody } from "@pontinho/api-contract";
import { request } from "./client";

export function profileQueryOptions() {
  return queryOptions({
    queryKey: ["profile"],
    queryFn: () => request<ProfileResponse>("/profile"),
  });
}

export function saveProfile(body: SaveProfileBody) {
  return request<ProfileResponse>("/profile", { method: "PUT", body });
}

export function requestPhotoUpload(body: PhotoUploadBody) {
  return request<PhotoUploadResponse>("/profile/photo-upload", { method: "POST", body });
}
