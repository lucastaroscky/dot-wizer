import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider, useSession } from "@/features/auth/SessionProvider";
import { MatchProvider, useMatch } from "@/features/match/MatchProvider";
import { ProfileLoadError } from "@/features/profile/ProfileLoadError";
import { useProfile } from "@/features/profile/useProfile";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <MatchProvider>
            <Routes />
          </MatchProvider>
        </SessionProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

function Routes() {
  const { session } = useSession();
  const { room } = useMatch();
  const signedIn = Boolean(session);
  const { profile, loading, failed, retry } = useProfile({ signedIn });
  const ready = session !== undefined && !loading;

  useEffect(() => {
    if (ready) {
      SplashScreen.hide();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }
  if (failed) {
    return <ProfileLoadError onRetry={retry} />;
  }

  const profileComplete = profile?.complete === true;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="(auth)/login" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && !profileComplete}>
        <Stack.Screen name="(auth)/profile-setup" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && profileComplete}>
        <Stack.Screen name="index" />
        <Stack.Screen name="lobby" />
        <Stack.Screen name="store" />
        <Stack.Protected guard={room !== undefined}>
          <Stack.Screen name="match" options={{ gestureEnabled: false }} />
        </Stack.Protected>
      </Stack.Protected>
    </Stack>
  );
}
