import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/shared/theme/colors";

type Props = { title: string; onPress: () => void; large?: boolean };

export function WoodButton({ title, onPress, large = false }: Props) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.outer, pressed && styles.pressed]}>
      <View style={[styles.inner, large && styles.innerLarge]}>
        <Text style={[styles.text, large && styles.textLarge]}>{title}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  outer: { backgroundColor: colors.woodDark, borderRadius: 10, padding: 3, boxShadow: "0 3px 6px rgba(0, 0, 0, 0.35)" },
  pressed: { opacity: 0.85 },
  inner: {
    backgroundImage: colors.woodGradient,
    borderWidth: 2,
    borderColor: colors.woodLight,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  innerLarge: { paddingVertical: 14, paddingHorizontal: 40 },
  text: { color: colors.woodText, fontSize: 15, fontWeight: "600" },
  textLarge: { fontSize: 24 },
});
