import { StyleSheet, Text, View } from "react-native";
import { WoodButton } from "@/shared/ui/WoodButton";
import { colors } from "@/shared/theme/colors";
import lobby from "@/messages/lobby.json";

type Props = { canResume: boolean; connecting: boolean; onResume: () => void; onBack: () => void };

export function OpenMatchPrompt({ canResume, connecting, onResume, onBack }: Props) {
  return (
    <View style={styles.content}>
      <Text style={styles.title}>{lobby.openMatch}</Text>
      {canResume && <WoodButton title={connecting ? lobby.connecting : lobby.resumeMatch} onPress={onResume} disabled={connecting} large />}
      <WoodButton title={lobby.back} onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center", gap: 14 },
  title: { color: colors.woodText, fontSize: 18, fontWeight: "700", textAlign: "center" },
});
