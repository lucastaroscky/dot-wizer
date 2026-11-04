import { Text } from "react-native";
import { colors } from "@/shared/theme/colors";
import home from "@/messages/home.json";

export function Logo({ size }: { size: number }) {
  return (
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: size, fontWeight: "600", letterSpacing: -0.02 * size }}>
      {home.title}
    </Text>
  );
}
