import { useState } from "react";
import { Modal, StyleSheet, Text, View } from "react-native";
import { WoodButton } from "@/shared/ui/WoodButton";
import { colors } from "@/shared/theme/colors";
import match from "@/messages/match.json";

type Props = { confirm: boolean; onExit: () => void };

export function ExitButton({ confirm, onExit }: Props) {
  const [asking, setAsking] = useState(false);

  function press() {
    if (!confirm) {
      onExit();
      return;
    }
    setAsking(true);
  }

  return (
    <>
      <WoodButton title={match.exit} onPress={press} />
      <Modal visible={asking} transparent animationType="fade" onRequestClose={() => setAsking(false)}>
        <View style={styles.backdrop}>
          <View style={styles.dialog}>
            <Text style={styles.message}>{match.exitConfirm.message}</Text>
            <WoodButton title={match.exitConfirm.confirm} onPress={onExit} large />
            <WoodButton title={match.exitConfirm.cancel} onPress={() => setAsking(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "rgba(0, 0, 0, 0.55)" },
  dialog: {
    alignItems: "center",
    gap: 14,
    width: "100%",
    maxWidth: 420,
    padding: 20,
    borderRadius: 16,
    borderWidth: 4,
    borderColor: colors.woodDark,
    backgroundImage: colors.woodGradient,
  },
  message: { color: colors.woodText, fontSize: 18, fontWeight: "600", textAlign: "center" },
});
