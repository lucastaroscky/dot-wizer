import { useState } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import { ErrorLine } from "./Notice";

type Props = TextInputProps & { label: string; error?: string };

export function TextField({ label, error = "", style, onFocus, onBlur, ...inputProps }: Props) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        placeholderTextColor={colors.faint}
        style={[styles.input, focused && styles.inputFocused, error !== "" && styles.inputError, style]}
      />
      <ErrorLine text={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { alignSelf: "stretch", gap: 8 },
  label: { color: colors.textSoft, fontSize: 14, fontFamily: fonts.semibold },
  input: {
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
    fontFamily: fonts.medium,
    outlineWidth: 0,
  },
  inputFocused: { borderColor: colors.action },
  inputError: { borderColor: colors.errorLine },
});
