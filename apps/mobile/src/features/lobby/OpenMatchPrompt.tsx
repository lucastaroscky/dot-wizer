import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/shared/ui/Button";
import { ErrorLine } from "@/shared/ui/Notice";
import { colors } from "@/shared/theme/colors";
import lobby from "@/messages/lobby.json";

type Props = { canResume: boolean; connecting: boolean; error: string; onResume: () => void; onBack: () => void };

export function OpenMatchPrompt({ canResume, connecting, error, onResume, onBack }: Props) {
  return (
    <>
      <View style={styles.center}>
        <View style={styles.table} aria-hidden>
          <View style={[styles.card, { left: 62, top: 40, transform: [{ rotate: "-12deg" }] }]} />
          <View style={[styles.card, { left: 88, top: 34 }]} />
          <View style={[styles.card, { left: 114, top: 40, transform: [{ rotate: "12deg" }] }]} />
          <View style={styles.light} />
        </View>
        <Text accessibilityRole="header" style={styles.title}>
          {lobby.openMatch}
        </Text>
        {!canResume && <Text style={styles.detail}>{lobby.openMatchElsewhere}</Text>}
      </View>
      <ErrorLine text={error} />
      {canResume && <Button title={connecting ? lobby.connecting : lobby.resumeMatch} onPress={onResume} loading={connecting} />}
      <Button title={lobby.back} onPress={onBack} variant="secondary" />
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 26 },
  table: { width: 220, height: 150, borderRadius: 28, backgroundColor: colors.feltNight, backgroundImage: colors.feltCard, boxShadow: "0 0 0 1px #1F3A2A" },
  card: { position: "absolute", width: 44, height: 62, borderRadius: 6, backgroundColor: "#16211B", borderWidth: 1, borderColor: colors.lineStrong },
  light: { position: "absolute", right: 14, top: 14, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.action },
  title: { maxWidth: 300, color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "600", textAlign: "center" },
  detail: { color: colors.muted, fontSize: 16, textAlign: "center" },
});
