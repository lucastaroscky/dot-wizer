import { Pressable, StyleSheet, View, type HostInstance } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { Card, type CardView, CARD_RATIO } from "@/shared/cards/Card";
import { colors } from "@/shared/theme/colors";

const CARD_WIDTH = 50;
const VISIBLE_HEIGHT = CARD_WIDTH * 0.68;

type Props = {
  melds: readonly { kind: string; cards: readonly CardView[] }[];
  highlightIndex?: number;
  onMeldPress: (index: number) => void;
  onMeldView: (index: number, view: HostInstance | null) => void;
};

function inDisplayOrder(meld: Props["melds"][number]) {
  if (meld.kind !== "run") {
    return meld.cards;
  }
  return [...meld.cards].reverse();
}

export function Melds({ melds, highlightIndex, onMeldPress, onMeldView }: Props) {
  return (
    <View style={styles.melds}>
      {melds.map((meld, index) => (
        <MeldColumn
          key={index}
          cards={inDisplayOrder(meld)}
          highlighted={index === highlightIndex}
          onPress={() => onMeldPress(index)}
          onView={(view) => onMeldView(index, view)}
        />
      ))}
    </View>
  );
}

type MeldColumnProps = {
  cards: readonly CardView[];
  highlighted: boolean;
  onPress: () => void;
  onView: (view: HostInstance | null) => void;
};

function MeldColumn({ cards, highlighted, onPress, onView }: MeldColumnProps) {
  return (
    <Animated.View ref={onView} layout={LinearTransition.duration(250)} entering={FadeIn.duration(200)}>
      <Pressable onPress={onPress} style={[styles.meld, highlighted && styles.highlight]}>
        {cards.map((card, cardIndex) => (
          <Animated.View key={card.id} layout={LinearTransition.duration(250)} style={cardIndex > 0 && styles.stacked}>
            <Card card={card} width={CARD_WIDTH} />
          </Animated.View>
        ))}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  melds: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10 },
  meld: { alignItems: "center", padding: 2, borderRadius: 6, borderWidth: 2, borderColor: "transparent" },
  highlight: { borderColor: colors.highlight },
  stacked: { marginTop: -(CARD_WIDTH * CARD_RATIO - VISIBLE_HEIGHT) },
});
