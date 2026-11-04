import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";

type Variant = "primary" | "secondary" | "plain";

type Props = { title: string; onPress: () => void; variant?: Variant; disabled?: boolean; loading?: boolean };

const SPINNER_COLORS: Record<Variant, string> = { primary: colors.onAction, secondary: colors.action, plain: colors.text };

export function Button({ title, onPress, variant = "primary", disabled = false, loading = false }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      style={({ pressed }) => [styles.button, styles[variant], pressed && styles.pressed, disabled && styles.disabled, loading && styles.loading]}
    >
      {loading && <ActivityIndicator size="small" color={SPINNER_COLORS[variant]} />}
      <Text style={[styles.text, variant === "primary" && styles.primaryText]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: 54, borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 16 },
  primary: { backgroundColor: colors.action },
  secondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  plain: { height: 48 },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.45 },
  loading: { opacity: 0.75 },
  text: { color: colors.text, fontSize: 16, fontFamily: fonts.semibold },
  primaryText: { color: colors.onAction, fontFamily: fonts.bold },
});
