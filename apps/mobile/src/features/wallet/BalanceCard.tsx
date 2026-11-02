import { StyleSheet, Text, View } from "react-native";
import { formatChips } from "@/shared/format/numbers";
import { colors } from "@/shared/theme/colors";
import wallet from "@/messages/wallet.json";

export function BalanceCard({ balance }: { balance: number }) {
  return (
    <View style={styles.card}>
      <Text style={styles.label}>{wallet.balance}</Text>
      <Text style={styles.value}>{formatChips(balance)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.felt,
    backgroundImage: colors.feltGradient,
    borderWidth: 4,
    borderColor: colors.woodDark,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 28,
  },
  label: { color: colors.cream, fontSize: 14, fontWeight: "600" },
  value: { color: colors.highlight, fontSize: 32, fontWeight: "700" },
});
