import { useState } from "react";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import { clearSessionEnd } from "@/shared/api/sessionEnd";
import { supabase } from "@/shared/supabase/client";
import auth from "@/messages/auth.json";
import type { GoogleLogin, GoogleLoginStatus } from "./GoogleLogin";

function readCallbackParams(callbackUrl: string) {
  const [addressAndQuery, fragment = ""] = callbackUrl.split("#");
  const query = addressAndQuery.split("?")[1] ?? "";
  return new URLSearchParams(`${query}&${fragment}`);
}

async function createSessionFromCallback(callbackUrl: string) {
  const params = readCallbackParams(callbackUrl);
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  if (!accessToken || !refreshToken) {
    throw new Error(params.get("error_code") ?? "missing_tokens");
  }
  const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
  if (error) {
    throw error;
  }
}

async function openGoogleSession(redirectTo: string) {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) {
    throw error;
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  return result.type === "success" ? result.url : undefined;
}

export function useGoogleLogin(): GoogleLogin {
  const [status, setStatus] = useState<GoogleLoginStatus>("idle");
  const [failed, setFailed] = useState(false);

  async function signIn() {
    if (status !== "idle") {
      return;
    }
    clearSessionEnd();
    setFailed(false);
    setStatus("open");
    try {
      const callbackUrl = await openGoogleSession(Linking.createURL(""));
      if (!callbackUrl) {
        setStatus("idle");
        return;
      }
      setStatus("checking");
      await createSessionFromCallback(callbackUrl);
    } catch {
      setFailed(true);
      setStatus("idle");
    }
  }

  return { status, error: failed ? auth.googleFailed : "", signIn };
}
