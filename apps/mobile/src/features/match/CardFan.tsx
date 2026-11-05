import { StyleSheet, View } from "react-native";
import { CardBack, CARD_RATIO } from "@/shared/cards/Card";

const MAX_VISIBLE = 9;
const CARD_WIDTH = 22;
const SPREAD_DEGREES = 6;
const STEP_RATIO = 0.27;

export function CardFan({ count, cardWidth = CARD_WIDTH }: { count: number; cardWidth?: number }) {
  const visible = Math.min(count, MAX_VISIBLE);
  const middle = (visible - 1) / 2;
  const step = cardWidth * STEP_RATIO;

  return (
    <View style={[styles.fan, { width: cardWidth + visible * step, height: cardWidth * CARD_RATIO + 4 }]}>
      {Array.from({ length: visible }, (_, index) => (
        <View
          key={index}
          style={[styles.card, { left: index * step, transform: [{ rotate: `${(index - middle) * SPREAD_DEGREES}deg` }] }]}
        >
          <CardBack width={cardWidth} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fan: { alignSelf: "center" },
  card: { position: "absolute", top: 2, transformOrigin: "bottom center" },
});
