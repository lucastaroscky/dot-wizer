import { createHash, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { SERVICE_TOKEN_HEADER } from "@pontinho/api-contract";
import { ApiError } from "../../common/errors/api-error.ts";

interface IsServiceTokenInput {
  provided: string | string[] | undefined;
  expected: string;
}

function digestOf(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}

export function isServiceToken({ provided, expected }: IsServiceTokenInput): boolean {
  if (typeof provided !== "string") {
    return false;
  }
  return timingSafeEqual(digestOf(provided), digestOf(expected));
}

export function createServiceTokenHook({ serviceToken }: { serviceToken: string }) {
  return async function requireServiceToken(request: FastifyRequest): Promise<void> {
    if (!isServiceToken({ provided: request.headers[SERVICE_TOKEN_HEADER], expected: serviceToken })) {
      throw new ApiError({ code: "serviceTokenInvalid" });
    }
  };
}
