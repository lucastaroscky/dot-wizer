import { StyleSheet, Text, View } from "react-native";
import { colors } from "@/shared/theme/colors";

const SYMBOLS = ["♠", "♥", "♦", "♣"];
const ROWS = 18;
const COLUMNS = 7;

export function SuitPattern() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: ROWS }, (_, row) => (
        <View key={row} style={styles.row}>
          {Array.from({ length: COLUMNS }, (_, column) => (
            <Text key={column} style={styles.symbol}>
              {SYMBOLS[(row + column) % SYMBOLS.length]}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-around", height: 56, alignItems: "center" },
  symbol: { color: colors.lobbyPattern, fontSize: 34 },
});
