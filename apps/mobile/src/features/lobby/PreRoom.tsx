import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { CreateOptions } from "@pontinho/protocol";
import { CHIP_TABLES } from "@pontinho/rules";
import type { CardStyleName } from "@/shared/cards/Card";
import { Button } from "@/shared/ui/Button";
import { ErrorLine } from "@/shared/ui/Notice";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import lobby from "@/messages/lobby.json";
import { CardStylePicker } from "./CardStylePicker";
import { TablePicker } from "./TablePicker";

export type LobbyChoice = CreateOptions & { cardStyle: CardStyleName };

type Props = { balance: number; connecting: boolean; error: string; onConfirm: (choice: LobbyChoice) => void };

export function PreRoom({ balance, connecting, error, onConfirm }: Props) {
  const [chosenTableId, setChosenTableId] = useState<number>();
  const [cardStyle, setCardStyle] = useState<CardStyleName>("jumbo");

  const unlockedTables = CHIP_TABLES.filter(({ minimumBalance }) => balance >= minimumBalance);
  const selectedTable = unlockedTables.find(({ id }) => id === chosenTableId) ?? unlockedTables[0];

  function confirm() {
    if (!selectedTable) {
      return;
    }
    onConfirm({ bots: false, table: selectedTable.id, cardStyle });
  }

  return (
    <>
      <CardStylePicker value={cardStyle} onChange={setCardStyle} />
      <View style={styles.group}>
        <Text style={styles.label}>{lobby.tables}</Text>
        <TablePicker tables={CHIP_TABLES} balance={balance} selectedId={selectedTable?.id} onSelect={setChosenTableId} />
      </View>
      <View style={styles.footer}>
        <ErrorLine text={error} />
        <Button title={connecting ? lobby.connecting : lobby.confirm} onPress={confirm} disabled={selectedTable === undefined} loading={connecting} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  label: { color: colors.muted, fontSize: 13, fontFamily: fonts.semibold },
  footer: { marginTop: "auto", gap: 10 },
});
