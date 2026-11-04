import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MAX_PLAYERS, MIN_PLAYERS, type CreateOptions } from "@pontinho/protocol";
import { CHIP_TABLES } from "@pontinho/rules";
import { Card, CARD_STYLES, CardStyleContext, type CardStyleName } from "@/shared/cards/Card";
import { Button } from "@/shared/ui/Button";
import { ErrorLine, Notice } from "@/shared/ui/Notice";
import { Option, optionTextColor } from "@/shared/ui/Option";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import lobby from "@/messages/lobby.json";
import { TablePicker } from "./TablePicker";

const SEAT_OPTIONS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, index) => MIN_PLAYERS + index);
const BOT_OPTIONS = [
  { value: true, label: lobby.yes },
  { value: false, label: lobby.no },
];
const SAMPLE_CARD = { id: "K-hearts-1", rank: "K", suit: "hearts" };

export type LobbyChoice = CreateOptions & { cardStyle: CardStyleName };

type Props = { balance: number; connecting: boolean; error: string; onConfirm: (choice: LobbyChoice) => void };

export function PreRoom({ balance, connecting, error, onConfirm }: Props) {
  const [seats, setSeats] = useState(MIN_PLAYERS);
  const [bots, setBots] = useState(false);
  const [chosenTableId, setChosenTableId] = useState<number>();
  const [cardStyle, setCardStyle] = useState<CardStyleName>("jumbo");

  const unlockedTables = CHIP_TABLES.filter(({ minimumBalance }) => balance >= minimumBalance);
  const selectedTable = unlockedTables.find(({ id }) => id === chosenTableId) ?? unlockedTables[0];
  const canConfirm = bots || selectedTable !== undefined;

  function confirm() {
    if (bots) {
      onConfirm({ bots: true, seats, cardStyle });
      return;
    }
    if (!selectedTable) {
      return;
    }
    onConfirm({ bots: false, table: selectedTable.id, cardStyle });
  }

  return (
    <>
      <View style={styles.row}>
        {bots && (
          <View style={styles.group}>
            <Text style={styles.label}>{lobby.seats}</Text>
            <View style={styles.options}>
              {SEAT_OPTIONS.map((option) => (
                <Option key={option} selected={option === seats} onPress={() => setSeats(option)} label={String(option)} style={styles.seat}>
                  <Text style={[styles.seatText, { color: optionTextColor(option === seats) }]}>{option}</Text>
                </Option>
              ))}
            </View>
          </View>
        )}
        <View style={styles.group}>
          <Text style={styles.label}>{lobby.bots}</Text>
          <View style={styles.options}>
            {BOT_OPTIONS.map(({ value, label }) => (
              <Option key={label} selected={value === bots} onPress={() => setBots(value)} label={label} style={styles.bot}>
                <Text style={[styles.optionText, { color: optionTextColor(value === bots) }]}>{label}</Text>
              </Option>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.label}>{lobby.cards}</Text>
        <View style={styles.options}>
          {CARD_STYLES.map((key) => (
            <Option key={key} selected={key === cardStyle} onPress={() => setCardStyle(key)} label={lobby.cardStyles[key]} style={styles.deck}>
              <CardStyleContext value={key}>
                <Card card={SAMPLE_CARD} width={24} />
              </CardStyleContext>
              <Text style={[styles.deckName, { color: optionTextColor(key === cardStyle) }]} numberOfLines={1}>
                {lobby.cardStyles[key]}
              </Text>
            </Option>
          ))}
        </View>
      </View>

      {bots ? (
        <Notice text={lobby.trainingHint} tone="neutral" />
      ) : (
        <View style={styles.group}>
          <Text style={styles.label}>{lobby.tables}</Text>
          <TablePicker tables={CHIP_TABLES} balance={balance} selectedId={selectedTable?.id} onSelect={setChosenTableId} />
        </View>
      )}

      <View style={styles.footer}>
        <ErrorLine text={error} />
        <Button title={connecting ? lobby.connecting : lobby.confirm} onPress={confirm} disabled={!canConfirm} loading={connecting} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 22 },
  group: { gap: 6 },
  label: { color: colors.muted, fontSize: 13, fontFamily: fonts.semibold },
  options: { flexDirection: "row", gap: 8 },
  seat: { width: 52 },
  seatText: { fontSize: 17, fontFamily: fonts.display },
  bot: { width: 64 },
  optionText: { fontSize: 15, fontFamily: fonts.semibold },
  deck: { flex: 1, height: 48, paddingHorizontal: 8, flexDirection: "row", justifyContent: "flex-start", gap: 6 },
  deckName: { flexShrink: 1, fontSize: 12, fontFamily: fonts.semibold },
  footer: { marginTop: "auto", gap: 10 },
});
