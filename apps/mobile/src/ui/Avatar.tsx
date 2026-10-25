import { StyleSheet, Text, View } from "react-native";
import { colors } from "../table/colors";

export function Avatar({ name, size }: { name: string; size: number }) {
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.initial, { fontSize: size * 0.5 }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.felt, borderWidth: 2, borderColor: colors.woodDark, alignItems: "center", justifyContent: "center" },
  initial: { color: colors.cream, fontWeight: "600" },
});
