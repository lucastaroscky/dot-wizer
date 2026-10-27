import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { MatchProvider, useMatch } from "@/features/match/MatchProvider";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <MatchProvider>
        <Routes />
      </MatchProvider>
    </GestureHandlerRootView>
  );
}

function Routes() {
  const { room } = useMatch();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="lobby" />
      <Stack.Protected guard={room !== undefined}>
        <Stack.Screen name="match" options={{ gestureEnabled: false }} />
      </Stack.Protected>
    </Stack>
  );
}
