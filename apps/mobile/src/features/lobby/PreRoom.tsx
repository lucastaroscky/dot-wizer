import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MAX_PLAYERS, MIN_PLAYERS, type CreateOptions } from "@pontinho/protocol";
import { CHIP_TABLES } from "@pontinho/rules";
import { Card, CARD_STYLES, CardStyleContext, type CardStyleName } from "@/shared/cards/Card";
import { WoodButton } from "@/shared/ui/WoodButton";
import { colors } from "@/shared/theme/colors";
import lobby from "@/messages/lobby.json";
import { TablePicker } from "./TablePicker";

const SEAT_OPTIONS = Array.from({ length: MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, index) => MIN_PLAYERS + index);
const SAMPLE_CARD = { id: "K-hearts-1", rank: "K", suit: "hearts" };

export type LobbyChoice = CreateOptions & { cardStyle: CardStyleName };

type Props = { balance: number; connecting: boolean; onConfirm: (choice: LobbyChoice) => void; onBack: () => void };

export function PreRoom({ balance, connecting, onConfirm, onBack }: Props) {
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
    <View style={styles.content}>
      <Text style={styles.label}>{lobby.bots}</Text>
      <View style={styles.row}>
        <Pressable onPress={() => setBots(true)} style={[styles.wideChip, bots && styles.chipSelected]}>
          <Text style={styles.chipText}>{lobby.yes}</Text>
        </Pressable>
        <Pressable onPress={() => setBots(false)} style={[styles.wideChip, !bots && styles.chipSelected]}>
          <Text style={styles.chipText}>{lobby.no}</Text>
        </Pressable>
      </View>

      {bots ? (
        <>
          <Text style={styles.hint}>{lobby.trainingHint}</Text>
          <Text style={styles.label}>{lobby.seats}</Text>
          <View style={styles.row}>
            {SEAT_OPTIONS.map((option) => (
              <Pressable key={option} onPress={() => setSeats(option)} style={[styles.chip, option === seats && styles.chipSelected]}>
                <Text style={styles.chipText}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <>
          <Text style={styles.label}>{lobby.tables}</Text>
          <TablePicker tables={CHIP_TABLES} balance={balance} selectedId={selectedTable?.id} onSelect={setChosenTableId} />
        </>
      )}

      <Text style={styles.label}>{lobby.cards}</Text>
      <View style={styles.row}>
        {CARD_STYLES.map((key) => (
          <Pressable key={key} onPress={() => setCardStyle(key)} style={[styles.styleOption, key === cardStyle && styles.styleSelected]}>
            <CardStyleContext value={key}>
              <Card card={SAMPLE_CARD} width={56} />
            </CardStyleContext>
            <Text style={styles.styleName}>{lobby.cardStyles[key]}</Text>
          </Pressable>
        ))}
      </View>

      <WoodButton title={connecting ? lobby.connecting : lobby.confirm} onPress={confirm} disabled={!canConfirm || connecting} large />
      <WoodButton title={lobby.back} onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center", gap: 14 },
  label: { color: colors.woodText, fontSize: 16, fontWeight: "600" },
  hint: { color: colors.woodText, fontSize: 14, marginBottom: 8 },
  row: { flexDirection: "row", gap: 12, marginBottom: 8 },
  chip: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundImage: colors.woodGradient,
    borderWidth: 3,
    borderColor: colors.woodDark,
  },
  wideChip: {
    width: 80,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundImage: colors.woodGradient,
    borderWidth: 3,
    borderColor: colors.woodDark,
  },
  chipSelected: { borderColor: colors.highlight, transform: [{ scale: 1.1 }] },
  chipText: { color: colors.woodText, fontSize: 20, fontWeight: "700" },
  styleOption: { alignItems: "center", gap: 6, padding: 6, borderRadius: 10, borderWidth: 3, borderColor: "transparent" },
  styleSelected: { borderColor: colors.highlight, backgroundColor: "rgba(0, 0, 0, 0.06)" },
  styleName: { color: colors.woodText, fontSize: 14, fontWeight: "600" },
});
