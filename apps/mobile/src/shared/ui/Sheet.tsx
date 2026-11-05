import type { ReactNode } from "react";
import { Modal, StyleSheet, View } from "react-native";
import { colors } from "@/shared/theme/colors";

type Props = { visible: boolean; onClose: () => void; children: ReactNode };

export function Sheet({ visible, onClose, children }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.sheet}>
          <View style={styles.grabber} aria-hidden />
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.62)" },
  sheet: { gap: 14, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 34, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginBottom: 8 },
});
