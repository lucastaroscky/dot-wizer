import { Pressable, StyleSheet, View, type HostInstance } from "react-native";
import Animated, { FadeIn, LinearTransition } from "react-native-reanimated";
import { Card, type CardView, CARD_RATIO } from "@/shared/cards/Card";
import { colors } from "@/shared/theme/colors";

const CARD_WIDTH = 50;
const VISIBLE_HEIGHT = CARD_WIDTH * 0.68;

type Props = {
  melds: readonly { kind: string; cards: readonly CardView[] }[];
  height: number;
  highlightIndex?: number;
  onMeldPress: (index: number) => void;
  onMeldView: (index: number, view: HostInstance | null) => void;
};

const SET_SUIT_ORDER = ["spades", "hearts", "clubs", "diamonds"];

function suitRank(card: CardView) {
  const rank = SET_SUIT_ORDER.indexOf(card.suit);
  return rank === -1 ? SET_SUIT_ORDER.length : rank;
}

function inDisplayOrder(meld: Props["melds"][number]) {
  if (meld.kind === "run") {
    return [...meld.cards].reverse();
  }
  return [...meld.cards].sort((a, b) => suitRank(a) - suitRank(b));
}

const CARD_HEIGHT = CARD_WIDTH * CARD_RATIO;
const COLUMN_FRAME = 8;

function visibleHeightFor(cardCount: number, height: number) {
  if (cardCount < 2 || height <= 0) {
    return VISIBLE_HEIGHT;
  }
  return Math.min(VISIBLE_HEIGHT, (height - CARD_HEIGHT - COLUMN_FRAME) / (cardCount - 1));
}

export function Melds({ melds, height, highlightIndex, onMeldPress, onMeldView }: Props) {
  return (
    <View style={styles.melds}>
      {melds.map((meld, index) => (
        <MeldColumn
          key={index}
          cards={inDisplayOrder(meld)}
          visibleHeight={visibleHeightFor(meld.cards.length, height)}
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
  visibleHeight: number;
  highlighted: boolean;
  onPress: () => void;
  onView: (view: HostInstance | null) => void;
};

function MeldColumn({ cards, visibleHeight, highlighted, onPress, onView }: MeldColumnProps) {
  return (
    <Animated.View ref={onView} layout={LinearTransition.duration(250)} entering={FadeIn.duration(200)}>
      <Pressable onPress={onPress} style={[styles.meld, highlighted && styles.highlight]}>
        {cards.map((card, cardIndex) => (
          <Animated.View key={card.id} layout={LinearTransition.duration(250)} style={cardIndex > 0 && { marginTop: visibleHeight - CARD_HEIGHT }}>
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
  highlight: { borderColor: colors.action },
});
