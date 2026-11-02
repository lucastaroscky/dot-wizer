import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/shared/theme/colors";
import { SuitPattern } from "./SuitPattern";

const KEYBOARD_BEHAVIOR = process.env.EXPO_OS === "ios" ? "padding" : undefined;

type Props = { title: string; error: string; children: ReactNode };

export function MenuScreen({ title, error, children }: Props) {
  return (
    <View style={styles.screen}>
      <SuitPattern />
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={styles.logo}>
              <Text style={styles.logoText}>{title}</Text>
            </View>
            {children}
            <Text style={styles.error}>{error}</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.lobby },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", alignItems: "center", gap: 20, padding: 32 },
  logo: { backgroundColor: colors.felt, backgroundImage: colors.feltGradient, borderWidth: 4, borderColor: colors.woodDark, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 32, marginBottom: 24 },
  logoText: { color: colors.cream, fontSize: 40, fontWeight: "500" },
  error: { color: colors.red, fontSize: 15, minHeight: 20 },
});
