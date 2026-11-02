import { MatchMakeError } from "@colyseus/sdk";
import { toJoinRefusal, toReconnectionToken } from "@pontinho/protocol";
import errors from "@/messages/errors.json";
import home from "@/messages/home.json";

type JoinFailure = { kind: "openMatch"; reconnectionToken?: string } | { kind: "refused"; text: string };

function isUnreachable(error: unknown) {
  if (error instanceof MatchMakeError) {
    return typeof error.code !== "number";
  }
  return error instanceof Error && error.name === "AbortError";
}

export function toJoinFailure(error: unknown): JoinFailure {
  if (isUnreachable(error)) {
    return { kind: "refused", text: errors.unreachable };
  }
  if (!(error instanceof MatchMakeError)) {
    return { kind: "refused", text: home.joinFailed };
  }
  const refusal = toJoinRefusal(error.message);
  if (refusal === "openMatch") {
    return { kind: "openMatch", reconnectionToken: toReconnectionToken(error.message) };
  }
  if (!refusal || refusal === "entryFailed") {
    return { kind: "refused", text: home.joinFailed };
  }
  return { kind: "refused", text: home.joinRefusals[refusal] };
}
