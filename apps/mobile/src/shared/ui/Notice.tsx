import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import errors from "@/messages/errors.json";
import { Icon, type IconName } from "./Icon";

type Tone = "neutral" | "danger" | "success";

const TONES: Record<Tone, { icon: IconName; text: string; box: object }> = {
  neutral: { icon: "info", text: colors.textSoft, box: { backgroundColor: colors.surface, borderColor: colors.line } },
  danger: { icon: "alert", text: colors.dangerText, box: { backgroundColor: colors.dangerSurface, borderColor: colors.dangerLine } },
  success: { icon: "check", text: colors.successText, box: { backgroundColor: colors.successSurface, borderColor: colors.successLine } },
};

type Props = { text: string; tone: Tone; onRetry?: () => void };

export function Notice({ text, tone, onRetry }: Props) {
  const look = TONES[tone];
  return (
    <View accessibilityRole={tone === "danger" ? "alert" : undefined} style={[styles.box, look.box]}>
      <View style={styles.row}>
        <Icon name={look.icon} size={18} color={look.text} />
        <Text style={[styles.text, { color: look.text }]}>{text}</Text>
      </View>
      {onRetry && (
        <Pressable onPress={onRetry} accessibilityRole="button" style={({ pressed }) => [styles.retry, pressed && styles.pressed]}>
          <Text style={styles.retryText}>{errors.retry}</Text>
        </Pressable>
      )}
    </View>
  );
}

export function ErrorLine({ text }: { text: string }) {
  if (!text) {
    return null;
  }
  return (
    <View accessibilityRole="alert" style={styles.row}>
      <Icon name="alert" size={17} color={colors.errorText} />
      <Text style={[styles.text, { color: colors.errorText }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, gap: 10 },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  retry: { alignSelf: "flex-start", height: 40, paddingHorizontal: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.retryLine, justifyContent: "center" },
  pressed: { opacity: 0.85 },
  retryText: { color: colors.retryText, fontSize: 14, fontFamily: fonts.semibold },
  text: { flex: 1, fontSize: 14, fontFamily: fonts.regular, lineHeight: 20 },
});
