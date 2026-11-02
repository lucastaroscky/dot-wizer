import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ChipTable } from "@pontinho/rules";
import { formatChips } from "@/shared/format/numbers";
import { colors } from "@/shared/theme/colors";
import lobby from "@/messages/lobby.json";

type Props = { tables: ChipTable[]; balance: number; selectedId?: number; onSelect: (tableId: number) => void };

export function TablePicker({ tables, balance, selectedId, onSelect }: Props) {
  return (
    <View style={styles.grid}>
      {tables.map((table) => {
        const locked = balance < table.minimumBalance;
        return (
          <Pressable
            key={table.id}
            disabled={locked}
            onPress={() => onSelect(table.id)}
            style={[styles.table, table.id === selectedId && styles.selected, locked && styles.locked]}
          >
            <Text style={styles.name}>{lobby.tableName.replace("{id}", String(table.id))}</Text>
            <Text style={styles.detail}>{lobby.minimumBalance.replace("{value}", formatChips(table.minimumBalance))}</Text>
            <Text style={styles.detail}>{lobby.pointValue.replace("{value}", formatChips(table.pointValue))}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, maxWidth: 340, marginBottom: 8 },
  table: {
    width: 104,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 10,
    backgroundImage: colors.woodGradient,
    borderWidth: 3,
    borderColor: colors.woodDark,
  },
  selected: { borderColor: colors.highlight },
  locked: { opacity: 0.4 },
  name: { color: colors.woodText, fontSize: 16, fontWeight: "700" },
  detail: { color: colors.woodText, fontSize: 12 },
});
