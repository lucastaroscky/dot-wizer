import { StyleSheet, View } from "react-native";
import { Button } from "@/shared/ui/Button";
import { Logo } from "@/shared/ui/Logo";
import { Notice } from "@/shared/ui/Notice";
import { Screen } from "@/shared/ui/Screen";
import profile from "@/messages/profile.json";

export function ProfileLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <Screen glow>
      <View style={styles.content}>
        <Logo size={34} />
        <Notice text={profile.loadFailed} tone="danger" />
        <Button title={profile.retry} onPress={onRetry} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: "center", gap: 14 },
});
