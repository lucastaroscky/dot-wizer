import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "@fastify/type-provider-zod";
import { API_ERROR_STATUS } from "@pontinho/api-contract";
import type { ApiErrorCode } from "@pontinho/api-contract";
import { Prisma } from "../../generated/prisma/client.ts";
import { ApiError, ERROR_MESSAGES } from "./api-error.ts";

const UNIQUE_CONSTRAINT_VIOLATION_CODE = "P2002";

interface ErrorBody {
  statusCode: number;
  code: ApiErrorCode;
  message: string | string[];
}

interface RegisterErrorHandlerInput {
  app: FastifyInstance;
}

interface BodyOfInput {
  code: ApiErrorCode;
  statusCode?: number;
  message?: string | string[];
}

function bodyOf({ code, statusCode = API_ERROR_STATUS[code], message = ERROR_MESSAGES[code] }: BodyOfInput): ErrorBody {
  return { statusCode, code, message };
}

export function registerErrorHandler({ app }: RegisterErrorHandlerInput): void {
  app.setErrorHandler(handleError);
  app.setNotFoundHandler(handleNotFound);
}

function handleError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  const envelope = toErrorBody({ error });
  if (envelope.statusCode >= 500) {
    request.log.error({ err: error }, `${request.method} ${request.url} -> ${envelope.statusCode}`);
  }
  return reply.status(envelope.statusCode).send(envelope);
}

function handleNotFound(_request: FastifyRequest, reply: FastifyReply) {
  const envelope = toErrorBody({ error: new ApiError({ code: "routeNotFound" }) });
  return reply.status(envelope.statusCode).send(envelope);
}

function toErrorBody({ error }: { error: unknown }): ErrorBody {
  if (error instanceof ApiError) {
    return bodyOf({ code: error.code, message: error.message });
  }
  if (hasZodFastifySchemaValidationErrors(error)) {
    return bodyOf({ code: "validationFailed", message: describeValidationErrors({ error }) });
  }
  if (isUniqueConstraintViolation(error)) {
    return bodyOf({ code: "uniqueConflict" });
  }
  if (isClientError(error)) {
    return bodyOf({ code: "badRequest", statusCode: error.statusCode });
  }
  return bodyOf({ code: "internalError" });
}

interface DescribeValidationErrorsInput {
  error: { validationContext?: string; validation: { instancePath: string; message?: string }[] };
}

function describeValidationErrors({ error }: DescribeValidationErrorsInput): string[] {
  return error.validation.map(
    ({ instancePath, message }) => `${error.validationContext ?? "request"}${instancePath}: ${message}`,
  );
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === UNIQUE_CONSTRAINT_VIOLATION_CODE
  );
}

function isClientError(error: unknown): error is { statusCode: number } {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { statusCode } = error as { statusCode?: unknown };
  return typeof statusCode === "number" && statusCode >= 400 && statusCode < 500;
}
