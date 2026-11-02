import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/shared/theme/colors";

export function SummaryBoard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.board}>
          <Text style={styles.title}>{title}</Text>
          {children}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  board: { backgroundImage: colors.woodGradient, borderWidth: 4, borderColor: colors.woodDark, borderRadius: 16, padding: 20, gap: 8, width: "100%", maxWidth: 520 },
  title: { color: colors.woodText, fontSize: 22, fontWeight: "600", textAlign: "center", marginBottom: 8 },
});
