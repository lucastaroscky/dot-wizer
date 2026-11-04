import { StyleSheet, Text, View } from "react-native";
import type { ChipTable } from "@pontinho/rules";
import { formatChips } from "@/shared/format/numbers";
import { Icon } from "@/shared/ui/Icon";
import { Option, optionTextColor } from "@/shared/ui/Option";
import { colors } from "@/shared/theme/colors";
import lobby from "@/messages/lobby.json";

type Props = { tables: ChipTable[]; balance: number; selectedId?: number; onSelect: (tableId: number) => void };

export function TablePicker({ tables, balance, selectedId, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {tables.map((table) => {
        const locked = balance < table.minimumBalance;
        const selected = table.id === selectedId;
        const title = lobby.pointValue.replace("{value}", formatChips(table.pointValue));
        return (
          <Option key={table.id} selected={selected} disabled={locked} onPress={() => onSelect(table.id)} label={title} style={styles.table}>
            <View style={styles.titleRow}>
              <Text style={[styles.title, { color: optionTextColor(selected) }]}>{title}</Text>
              {locked && <Icon name="lock" size={13} color={colors.optionText} />}
            </View>
            <View>
              <Text style={[styles.detail, selected && styles.detailSelected]}>{lobby.tableName.replace("{id}", String(table.id))}</Text>
              <Text style={[styles.detail, selected && styles.detailSelected]}>{lobby.minimumBalance.replace("{value}", formatChips(table.minimumBalance))}</Text>
            </View>
          </Option>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  table: { width: "31.5%", height: 70, paddingVertical: 8, paddingHorizontal: 10, alignItems: "stretch", justifyContent: "space-between" },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 12.5, fontWeight: "600" },
  detail: { color: colors.optionMuted, fontSize: 11, fontVariant: ["tabular-nums"] },
  detailSelected: { color: colors.optionText },
});
