import { queryOptions } from "@tanstack/react-query";
import type { ProfileResponse, RegistrationBody } from "@pontinho/api-contract";
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
