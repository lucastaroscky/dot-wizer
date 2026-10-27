import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/shared/theme/colors";
import { SuitPattern } from "./SuitPattern";

type Props = { title: string; error: string; children: ReactNode };

export function MenuScreen({ title, error, children }: Props) {
  return (
    <View style={styles.screen}>
      <SuitPattern />
      <SafeAreaView style={styles.content}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>{title}</Text>
        </View>
        {children}
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.lobby },
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, padding: 32 },
  logo: { backgroundColor: colors.felt, backgroundImage: colors.feltGradient, borderWidth: 4, borderColor: colors.woodDark, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 32, marginBottom: 24 },
  logoText: { color: colors.cream, fontSize: 40, fontWeight: "500" },
  error: { color: colors.red, fontSize: 15, minHeight: 20 },
});
