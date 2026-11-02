import { AppState, Platform } from "react-native";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/shared/config/env";
import { authStorage } from "./storage";

const isWeb = Platform.OS === "web";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: isWeb,
  },
});

if (!isWeb) {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
      return;
    }
    supabase.auth.stopAutoRefresh();
  });
}
