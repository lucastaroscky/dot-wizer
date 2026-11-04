import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Button } from "@/shared/ui/Button";
import { Icon } from "@/shared/ui/Icon";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import match from "@/messages/match.json";

type Props = { title: string; confirm: boolean; onExit: () => void };

export function ExitButton({ title, confirm, onExit }: Props) {
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
      <Pressable onPress={press} accessibilityRole="button" style={styles.button}>
        <Icon name="back" size={18} color={colors.text} />
        <Text style={styles.buttonText}>{title}</Text>
      </Pressable>
      <Modal visible={asking} transparent animationType="slide" onRequestClose={() => setAsking(false)}>
        <View style={styles.backdrop}>
          <View accessibilityViewIsModal style={styles.sheet}>
            <View style={styles.grabber} aria-hidden />
            <Text style={styles.message}>{match.exitConfirm.message}</Text>
            <Button title={match.exitConfirm.cancel} onPress={() => setAsking(false)} />
            <Button title={match.exitConfirm.confirm} onPress={onExit} variant="secondary" />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: { height: 40, paddingLeft: 10, paddingRight: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: "rgba(10, 13, 12, 0.55)", flexDirection: "row", alignItems: "center", gap: 6 },
  buttonText: { color: colors.text, fontSize: 14, fontFamily: fonts.semibold },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.62)" },
  sheet: { gap: 14, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 34, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginBottom: 8 },
  message: { color: colors.text, fontSize: 19, lineHeight: 26, fontFamily: fonts.display, marginBottom: 8 },
});
