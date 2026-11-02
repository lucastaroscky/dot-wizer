import createError from "@fastify/error";

export const BadRequestError = createError("BAD_REQUEST", "%s", 400);
export const UnauthorizedError = createError("UNAUTHORIZED", "%s", 401);
export const ForbiddenError = createError("FORBIDDEN", "%s", 403);
export const NotFoundError = createError("NOT_FOUND", "%s", 404);
export const ConflictError = createError("CONFLICT", "%s", 409);
export const UnprocessableError = createError("UNPROCESSABLE", "%s", 422);
export const TooManyRequestsError = createError("TOO_MANY_REQUESTS", "%s", 429);
