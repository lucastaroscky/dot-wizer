import { currentDevLogin } from "@/shared/api/devLogin";
import { supabase } from "./client";

export async function getSignedInUserId() {
  const devLogin = currentDevLogin();
  if (devLogin) {
    return devLogin.userId;
  }
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id;
}

export function onSignedOut(listener: () => void) {
  const { data } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      listener();
    }
  });
  return () => data.subscription.unsubscribe();
}
