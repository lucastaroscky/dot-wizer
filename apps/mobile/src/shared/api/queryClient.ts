import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

const MAX_READ_RETRIES = 2;
const CLIENT_ERROR_STATUS = 400;
const SERVER_ERROR_STATUS = 500;

function shouldRetryRead(failureCount: number, error: Error) {
  const isClientError = error instanceof ApiError && error.statusCode >= CLIENT_ERROR_STATUS && error.statusCode < SERVER_ERROR_STATUS;
  if (isClientError) {
    return false;
  }
  return failureCount < MAX_READ_RETRIES;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: shouldRetryRead, networkMode: "always" },
    mutations: { networkMode: "always" },
  },
});
