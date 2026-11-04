import { StyleSheet, Text, View } from "react-native";
import { formatChips } from "@/shared/format/numbers";
import { Icon } from "@/shared/ui/Icon";
import { colors } from "@/shared/theme/colors";
import wallet from "@/messages/wallet.json";

const UNKNOWN_BALANCE = "—";

export function BalanceCard({ balance }: { balance?: number }) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Icon name="chip" size={18} color={colors.action} />
        <Text style={styles.value}>{balance === undefined ? UNKNOWN_BALANCE : formatChips(balance)}</Text>
      </View>
      <Text style={styles.label}>{wallet.balance}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: "flex-end", gap: 2 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  value: { color: colors.text, fontSize: 19, fontWeight: "600", fontVariant: ["tabular-nums"] },
  label: { color: colors.muted, fontSize: 11, fontWeight: "600" },
});
