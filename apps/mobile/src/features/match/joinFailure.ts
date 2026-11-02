import { MatchMakeError } from "@colyseus/sdk";
import { toJoinRefusal, toReconnectionToken } from "@pontinho/protocol";
import home from "@/messages/home.json";

type JoinFailure = { kind: "openMatch"; reconnectionToken?: string } | { kind: "refused"; text: string };

export function toJoinFailure(error: unknown): JoinFailure {
  if (!(error instanceof MatchMakeError)) {
    return { kind: "refused", text: home.joinFailed };
  }
  const refusal = toJoinRefusal(error.message);
  if (refusal === "openMatch") {
    return { kind: "openMatch", reconnectionToken: toReconnectionToken(error.message) };
  }
  if (!refusal) {
    return { kind: "refused", text: home.joinFailed };
  }
  return { kind: "refused", text: home.joinRefusals[refusal] };
}
