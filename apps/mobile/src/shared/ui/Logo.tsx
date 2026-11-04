import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import home from "@/messages/home.json";

const DOTLESS_I = "ı";

export function Logo({ size }: { size: number }) {
  const dotIndex = home.title.indexOf("i");
  const text = { color: colors.text, fontSize: size, lineHeight: size * 1.2, fontFamily: fonts.display, letterSpacing: -0.02 * size };
  const dot = size * 0.24;

  return (
    <View accessibilityRole="header" accessibilityLabel={home.title} style={styles.row}>
      <Text style={text}>{home.title.slice(0, dotIndex)}</Text>
      <View>
        <Text style={text}>{DOTLESS_I}</Text>
        <View style={[styles.dot, { width: dot, height: dot, borderRadius: dot / 2, top: size * 0.12, marginLeft: -dot / 2 }]} />
      </View>
      <Text style={text}>{home.title.slice(dotIndex + 1)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row" },
  dot: { position: "absolute", left: "50%", backgroundColor: colors.brandDot },
});
