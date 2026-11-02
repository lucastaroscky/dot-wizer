import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@/shared/theme/colors";

type Props = TextInputProps & { label: string };

export function TextField({ label, style, ...inputProps }: Props) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...inputProps} accessibilityLabel={label} placeholderTextColor={colors.placeholder} style={[styles.input, style]} />
    </View>
  );
}

const styles = StyleSheet.create({
  field: { width: 280, gap: 6 },
  label: { color: colors.woodText, fontSize: 16, fontWeight: "600" },
  input: {
    backgroundColor: colors.cream,
    borderWidth: 3,
    borderColor: colors.woodDark,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    color: colors.woodText,
    fontSize: 18,
  },
});
