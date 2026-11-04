import { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import auth from "@/messages/auth.json";
import { CODE_LENGTH } from "./useEmailLogin";

type Props = { value: string; onChange: (code: string) => void; onSubmit: () => void; invalid: boolean };

const BOXES = Array.from({ length: CODE_LENGTH }, (_, index) => index);

export function CodeField({ value, onChange, onSubmit, invalid }: Props) {
  const [focused, setFocused] = useState(false);

  function boxBorder(index: number) {
    if (invalid) {
      return colors.errorLine;
    }
    if (focused && index === Math.min(value.length, CODE_LENGTH - 1)) {
      return colors.action;
    }
    return colors.lineStrong;
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{auth.codeLabel}</Text>
      <View style={styles.boxes}>
        {BOXES.map((index) => (
          <View key={index} style={[styles.box, { borderColor: boxBorder(index) }]}>
            <Text style={styles.digit}>{value[index] ?? ""}</Text>
          </View>
        ))}
        <TextInput
          value={value}
          onChangeText={(text) => onChange(text.replace(/\D/g, ""))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onSubmitEditing={onSubmit}
          accessibilityLabel={auth.codeLabel}
          keyboardType="number-pad"
          maxLength={CODE_LENGTH}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          autoFocus
          caretHidden
          style={styles.input}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: colors.textSoft, fontSize: 14, fontFamily: fonts.semibold },
  boxes: { flexDirection: "row", gap: 8 },
  box: { flex: 1, height: 58, borderRadius: 12, borderWidth: 1.5, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  digit: { color: colors.text, fontSize: 22, fontFamily: fonts.display },
  input: { ...StyleSheet.absoluteFill, color: "transparent", opacity: 0.02, fontSize: 1, outlineWidth: 0 },
});
