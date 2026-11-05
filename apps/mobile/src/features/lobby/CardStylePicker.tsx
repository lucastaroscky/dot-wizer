import { StyleSheet, Text, View } from "react-native";
import { Card, CARD_STYLES, CardStyleContext, type CardStyleName } from "@/shared/cards/Card";
import { Option, optionTextColor } from "@/shared/ui/Option";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import lobby from "@/messages/lobby.json";

const SAMPLE_CARD = { id: "K-hearts-1", rank: "K", suit: "hearts" };

export function CardStylePicker({ value, onChange }: { value: CardStyleName; onChange: (cardStyle: CardStyleName) => void }) {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{lobby.cards}</Text>
      <View style={styles.options}>
        {CARD_STYLES.map((key) => (
          <Option key={key} selected={key === value} onPress={() => onChange(key)} label={lobby.cardStyles[key]} style={styles.deck}>
            <CardStyleContext value={key}>
              <Card card={SAMPLE_CARD} width={32} />
            </CardStyleContext>
            <Text style={[styles.deckName, { color: optionTextColor(key === value) }]}>{lobby.cardStyles[key]}</Text>
          </Option>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 6 },
  label: { color: colors.muted, fontSize: 13, fontFamily: fonts.semibold },
  options: { flexDirection: "row", gap: 8 },
  deck: { flex: 1, paddingVertical: 8, gap: 6 },
  deckName: { fontSize: 12, fontFamily: fonts.semibold },
});
