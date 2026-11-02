import { supabase } from "./client";

export async function getSignedInUserId() {
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
