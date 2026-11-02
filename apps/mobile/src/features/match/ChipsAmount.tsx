import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";
import { formatSignedChips } from "@/shared/format/numbers";
import { colors } from "@/shared/theme/colors";

type Props = { value: number; style?: StyleProp<TextStyle> };

export function ChipsAmount({ value, style }: Props) {
  return <Text style={[style, value > 0 && styles.gain, value < 0 && styles.loss]}>{formatSignedChips(value)}</Text>;
}

const styles = StyleSheet.create({
  gain: { color: colors.felt },
  loss: { color: colors.red },
});
