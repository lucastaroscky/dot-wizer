import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Card, CARD_STYLE_NAMES, CardStyleContext, type CardStyleName } from "../cards/Card";
import { WoodButton } from "../ui/WoodButton";
import { colors } from "../table/colors";

const SEAT_OPTIONS = [3, 4, 5, 6];
const SAMPLE_CARD = { id: "K-hearts-1", rank: "K", suit: "hearts" };

export type MatchSettings = { seats: number; bots: boolean; cardStyle: CardStyleName };

type Props = { onConfirm: (settings: MatchSettings) => void; onBack: () => void };

export function PreRoom({ onConfirm, onBack }: Props) {
  const [seats, setSeats] = useState(3);
  const [bots, setBots] = useState(false);
  const [cardStyle, setCardStyle] = useState<CardStyleName>("jumbo");

  return (
    <View style={styles.content}>
      <Text style={styles.label}>Jogadores na mesa</Text>
      <View style={styles.row}>
        {SEAT_OPTIONS.map((option) => (
          <Pressable key={option} onPress={() => setSeats(option)} style={[styles.chip, option === seats && styles.chipSelected]}>
            <Text style={styles.chipText}>{option}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Jogar com robôs</Text>
      <View style={styles.row}>
        <Pressable onPress={() => setBots(true)} style={[styles.wideChip, bots && styles.chipSelected]}>
          <Text style={styles.chipText}>Sim</Text>
        </Pressable>
        <Pressable onPress={() => setBots(false)} style={[styles.wideChip, !bots && styles.chipSelected]}>
          <Text style={styles.chipText}>Não</Text>
        </Pressable>
      </View>

      <Text style={styles.label}>Cartas</Text>
      <View style={styles.row}>
        {Object.entries(CARD_STYLE_NAMES).map(([key, name]) => (
          <Pressable key={key} onPress={() => setCardStyle(key as CardStyleName)} style={[styles.styleOption, key === cardStyle && styles.styleSelected]}>
            <CardStyleContext value={key as CardStyleName}>
              <Card card={SAMPLE_CARD} width={56} />
            </CardStyleContext>
            <Text style={styles.styleName}>{name}</Text>
          </Pressable>
        ))}
      </View>

      <WoodButton title="OK" onPress={() => onConfirm({ seats, bots, cardStyle })} large />
      <WoodButton title="Voltar" onPress={onBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center", gap: 14 },
  label: { color: colors.woodText, fontSize: 16, fontWeight: "600" },
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
