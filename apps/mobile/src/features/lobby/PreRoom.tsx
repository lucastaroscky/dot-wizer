import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MAX_PLAYERS, type CreateOptions } from "@pontinho/protocol";
import { CHIP_TABLES } from "@pontinho/rules";
import type { CardStyleName } from "@/shared/cards/Card";
import { Button } from "@/shared/ui/Button";
import { ErrorLine } from "@/shared/ui/Notice";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import lobby from "@/messages/lobby.json";
import { CardStylePicker } from "./CardStylePicker";
import { TableList } from "./TableList";
import { useTables } from "./useTables";

export type LobbyChoice = CreateOptions & { cardStyle: CardStyleName };

type Props = { balance: number; connecting: boolean; error: string; onConfirm: (choice: LobbyChoice) => void };

export function PreRoom({ balance, connecting, error, onConfirm }: Props) {
  const [chosenTableId, setChosenTableId] = useState<number>();
  const [cardStyle, setCardStyle] = useState<CardStyleName>("jumbo");
  const tables = useTables();

  function sit(table: number) {
    setChosenTableId(table);
    onConfirm({ bots: false, table, cardStyle });
  }

  return (
    <>
      <CardStylePicker value={cardStyle} onChange={setCardStyle} />
      <View style={styles.group}>
        <View style={styles.header}>
          <Text style={styles.label}>{lobby.tablesWithSeats.replace("{seats}", String(MAX_PLAYERS))}</Text>
          <Button title={lobby.refresh} onPress={tables.refresh} variant="plain" loading={tables.refreshing} />
        </View>
        <Text style={styles.hint}>{lobby.tapToSit}</Text>
        <ErrorLine text={tables.error} />
        <TableList tables={CHIP_TABLES} listings={tables.tables} balance={balance} seatingId={connecting ? chosenTableId : undefined} disabled={connecting} onSit={sit} />
      </View>
      <ErrorLine text={error} />
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { color: colors.muted, fontSize: 13, fontFamily: fonts.semibold },
  hint: { color: colors.muted, fontSize: 13, fontFamily: fonts.medium },
});
