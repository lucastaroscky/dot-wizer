import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MAX_PLAYERS, type TableListing } from "@pontinho/protocol";
import type { ChipTable } from "@pontinho/rules";
import { formatChips } from "@/shared/format/numbers";
import { Avatar } from "@/shared/ui/Avatar";
import { Icon } from "@/shared/ui/Icon";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import lobby from "@/messages/lobby.json";

const UNKNOWN = "—";

type Props = {
  tables: ChipTable[];
  listings?: TableListing[];
  balance: number;
  seatingId?: number;
  disabled: boolean;
  onSit: (tableId: number) => void;
};

function countText(listing: TableListing | undefined, seats: number) {
  if (!listing) {
    return UNKNOWN;
  }
  if (listing.players.length === 0) {
    return lobby.emptyTable;
  }
  return lobby.seated.replace("{count}", String(listing.players.length)).replace("{seats}", String(seats));
}

export function TableList({ tables, listings, balance, seatingId, disabled, onSit }: Props) {
  return (
    <View style={styles.list}>
      {tables.map((table) => {
        const locked = balance < table.minimumBalance;
        const seating = table.id === seatingId;
        const listing = listings?.find(({ table: id }) => id === table.id);
        const title = lobby.pointValue.replace("{value}", formatChips(table.pointValue));
        const detail = `${lobby.tableName.replace("{id}", String(table.id))} · ${lobby.minimumBalance.replace("{value}", formatChips(table.minimumBalance))}`;
        return (
          <Pressable
            key={table.id}
            onPress={() => onSit(table.id)}
            disabled={locked || disabled}
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${detail}, ${countText(listing, MAX_PLAYERS)}`}
            accessibilityState={{ disabled: locked || disabled, busy: seating }}
            style={({ pressed }) => [styles.row, seating && styles.rowSeating, locked && styles.locked, pressed && styles.pressed]}
          >
            <View style={styles.text}>
              <View style={styles.titleRow}>
                <Text style={styles.title}>{title}</Text>
                {locked && <Icon name="lock" size={13} color={colors.optionText} />}
              </View>
              <Text style={styles.detail}>{detail}</Text>
            </View>
            {seating ? (
              <View style={styles.seating}>
                <ActivityIndicator size="small" color={colors.onSelected} />
                <Text style={styles.seatingText}>{lobby.connecting}</Text>
              </View>
            ) : (
              <View style={styles.people}>
                <View style={styles.avatars}>
                  {listing?.players.map((player, index) => (
                    <View key={index} style={styles.avatar}>
                      <Avatar name={player.nickname} size={24} photoUrl={player.photoUrl} />
                    </View>
                  ))}
                </View>
                <Text style={styles.count}>{countText(listing, MAX_PLAYERS)}</Text>
              </View>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 6 },
  row: { height: 58, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.option, flexDirection: "row", alignItems: "center", gap: 10 },
  rowSeating: { borderWidth: 1.5, borderColor: colors.text, backgroundColor: colors.selected },
  locked: { opacity: 0.4 },
  pressed: { opacity: 0.85 },
  text: { flex: 1, minWidth: 0, gap: 1 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { color: colors.optionText, fontSize: 14, fontFamily: fonts.display },
  detail: { color: colors.optionMuted, fontSize: 11.5, fontFamily: fonts.regular, fontVariant: ["tabular-nums"] },
  seating: { flexDirection: "row", alignItems: "center", gap: 6 },
  seatingText: { color: colors.onSelected, fontSize: 12.5, fontFamily: fonts.semibold },
  people: { flexDirection: "row", alignItems: "center", gap: 8 },
  avatars: { flexDirection: "row" },
  avatar: { marginLeft: -6, borderRadius: 12, borderWidth: 2, borderColor: colors.option },
  count: { minWidth: 40, textAlign: "right", color: colors.optionText, fontSize: 12.5, fontFamily: fonts.semibold, fontVariant: ["tabular-nums"] },
});
