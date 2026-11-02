import { STATUS_CODES } from "node:http";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { hasZodFastifySchemaValidationErrors } from "@fastify/type-provider-zod";
import { Prisma } from "../../generated/prisma/client.ts";
import errors from "../messages/errors.json" with { type: "json" };

const UNIQUE_CONSTRAINT_VIOLATION_CODE = "P2002";

interface ErrorBody {
  statusCode: number;
  message: string | string[];
}

interface ErrorEnvelope extends ErrorBody {
  error: string;
  path: string;
  timestamp: string;
}

interface ToEnvelopeInput {
  error: unknown;
  path: string;
}

interface RegisterErrorHandlerInput {
  app: FastifyInstance;
}

export function registerErrorHandler({ app }: RegisterErrorHandlerInput): void {
  app.setErrorHandler(handleError);
  app.setNotFoundHandler(handleNotFound);
}

function handleError(error: unknown, request: FastifyRequest, reply: FastifyReply) {
  const envelope = toEnvelope({ error, path: request.url });
  if (envelope.statusCode >= 500) {
    request.log.error({ err: error }, `${request.method} ${request.url} -> ${envelope.statusCode}`);
  }
  return reply.status(envelope.statusCode).send(envelope);
}

function handleNotFound(request: FastifyRequest, reply: FastifyReply) {
  const envelope = toEnvelope({
    error: { statusCode: 404, message: errors.common.routeNotFound },
    path: request.url,
  });
  return reply.status(envelope.statusCode).send(envelope);
}

function toEnvelope({ error, path }: ToEnvelopeInput): ErrorEnvelope {
  const { statusCode, message } = toErrorBody({ error });
  return {
    statusCode,
    message,
    error: STATUS_CODES[statusCode] ?? "Error",
    path,
    timestamp: new Date().toISOString(),
  };
}

function toErrorBody({ error }: { error: unknown }): ErrorBody {
  if (hasZodFastifySchemaValidationErrors(error)) {
    return { statusCode: 400, message: describeValidationErrors({ error }) };
  }
  if (isUniqueConstraintViolation(error)) {
    return { statusCode: 409, message: errors.common.uniqueConflict };
  }
  if (isClientError(error)) {
    return { statusCode: error.statusCode, message: error.message };
  }
  return { statusCode: 500, message: errors.common.internalError };
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

function isClientError(error: unknown): error is { statusCode: number; message: string } {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const { statusCode, message } = error as { statusCode?: unknown; message?: unknown };
  return typeof statusCode === "number" && statusCode >= 400 && statusCode < 500 && typeof message === "string";
}
