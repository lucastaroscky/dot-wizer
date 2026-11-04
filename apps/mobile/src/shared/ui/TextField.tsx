import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@/shared/theme/colors";
import { ErrorLine } from "./Notice";

type Props = TextInputProps & { label: string; error?: string };

export function TextField({ label, error = "", style, ...inputProps }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...inputProps}
        accessibilityLabel={label}
        placeholderTextColor={colors.faint}
        style={[styles.input, error !== "" && styles.inputError, style]}
      />
      <ErrorLine text={error} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { alignSelf: "stretch", gap: 8 },
  label: { color: colors.textSoft, fontSize: 14, fontWeight: "600" },
  input: {
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: 16,
    fontWeight: "500",
  },
  inputError: { borderColor: colors.errorLine },
});
