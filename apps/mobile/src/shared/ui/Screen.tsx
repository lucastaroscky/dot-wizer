import type { ReactNode } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "@/shared/theme/colors";

const KEYBOARD_BEHAVIOR = process.env.EXPO_OS === "ios" ? "padding" : undefined;

type Props = { children: ReactNode; glow?: boolean };

export function Screen({ children, glow = false }: Props) {
  return (
    <View style={[styles.screen, glow && styles.glow]}>
      <SafeAreaView style={styles.fill}>
        <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={styles.fill}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.night },
  glow: { backgroundImage: colors.nightGlow },
  fill: { flex: 1 },
  content: { flexGrow: 1, width: "100%", maxWidth: 480, alignSelf: "center", gap: 14, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 28 },
});
