import type { ReactNode } from "react";
import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/shared/theme/colors";

type Props = { selected: boolean; onPress: () => void; label: string; disabled?: boolean; style?: StyleProp<ViewStyle>; children: ReactNode };

export function Option({ selected, onPress, label, disabled = false, style, children }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      style={[styles.option, selected && styles.selected, disabled && styles.disabled, style]}
    >
      {children}
    </Pressable>
  );
}

export function optionTextColor(selected: boolean) {
  return selected ? colors.onSelected : colors.optionText;
}

const styles = StyleSheet.create({
  option: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.option, alignItems: "center", justifyContent: "center" },
  selected: { backgroundColor: colors.selected, borderColor: colors.text, borderWidth: 1.5 },
  disabled: { opacity: 0.4 },
});
