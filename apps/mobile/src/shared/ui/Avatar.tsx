import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/shared/theme/colors";

type Props = { name: string; size: number; photoUrl?: string | null };

export function Avatar({ name, size, photoUrl }: Props) {
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (photoUrl) {
    return <Image source={{ uri: photoUrl }} style={[styles.circle, shape]} contentFit="cover" />;
  }
  return (
    <View style={[styles.circle, shape]}>
      <Text style={[styles.initial, { fontSize: size * 0.5 }]}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { backgroundColor: colors.felt, borderWidth: 2, borderColor: colors.woodDark, alignItems: "center", justifyContent: "center" },
  initial: { color: colors.cream, fontWeight: "600" },
});
