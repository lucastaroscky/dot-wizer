import { StyleSheet, View } from "react-native";
import { CardBack, CARD_RATIO } from "../cards/Card";

const MAX_VISIBLE = 9;
const CARD_WIDTH = 22;
const SPREAD_DEGREES = 6;

export function CardFan({ count }: { count: number }) {
  const visible = Math.min(count, MAX_VISIBLE);
  const middle = (visible - 1) / 2;

  return (
    <View style={[styles.fan, { width: CARD_WIDTH + visible * 6 }]}>
      {Array.from({ length: visible }, (_, index) => (
        <View
          key={index}
          style={[styles.card, { left: index * 6, transform: [{ rotate: `${(index - middle) * SPREAD_DEGREES}deg` }] }]}
        >
          <CardBack width={CARD_WIDTH} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fan: { height: CARD_WIDTH * CARD_RATIO + 4, alignSelf: "center" },
  card: { position: "absolute", top: 2, transformOrigin: "bottom center" },
});
