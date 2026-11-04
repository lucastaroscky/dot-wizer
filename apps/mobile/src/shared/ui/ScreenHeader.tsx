import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/shared/theme/colors";
import { Icon } from "./Icon";

type Props = { title: string; backLabel: string; onBack: () => void; children?: ReactNode };

export function ScreenHeader({ title, backLabel, onBack, children }: Props) {
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={backLabel} style={styles.back}>
        <Icon name="back" size={20} color={colors.text} />
      </Pressable>
      <Text accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 48, flexDirection: "row", alignItems: "center", gap: 12 },
  back: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, color: colors.text, fontSize: 20, fontWeight: "600" },
});
