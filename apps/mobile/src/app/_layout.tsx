import { useEffect } from "react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Onest_400Regular } from "@expo-google-fonts/onest/400Regular";
import { Onest_500Medium } from "@expo-google-fonts/onest/500Medium";
import { Onest_600SemiBold } from "@expo-google-fonts/onest/600SemiBold";
import { Onest_700Bold } from "@expo-google-fonts/onest/700Bold";
import { Unbounded_600SemiBold } from "@expo-google-fonts/unbounded/600SemiBold";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { QueryClientProvider } from "@tanstack/react-query";
import { SessionProvider, useSession } from "@/features/auth/SessionProvider";
import { MatchProvider, useMatch } from "@/features/match/MatchProvider";
import { ProfileLoadError } from "@/features/profile/ProfileLoadError";
import { useProfile } from "@/features/profile/useProfile";
import { queryClient } from "@/shared/api/queryClient";

SplashScreen.preventAutoHideAsync();

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
  const { userId } = useSession();
  const { room } = useMatch();
  const signedIn = Boolean(userId);
  const { profile, loading, failed, retry } = useProfile({ signedIn });
  const [fontsLoaded, fontsFailed] = useFonts({ Onest_400Regular, Onest_500Medium, Onest_600SemiBold, Onest_700Bold, Unbounded_600SemiBold });
  const ready = userId !== undefined && !loading && (fontsLoaded || fontsFailed !== null);

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
        <Stack.Screen name="training" />
        <Stack.Screen name="store" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="payments" />
        <Stack.Protected guard={room !== undefined}>
          <Stack.Screen name="match" options={{ gestureEnabled: false }} />
        </Stack.Protected>
      </Stack.Protected>
    </Stack>
  );
}
