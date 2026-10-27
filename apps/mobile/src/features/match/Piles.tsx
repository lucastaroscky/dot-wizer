import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Card, CardBack, type CardView, CARD_RATIO } from "@/shared/cards/Card";
import { colors } from "@/shared/theme/colors";
import type { Rect } from "./areas";
import { Measured } from "./Measured";

const CARD_WIDTH = 50;
const STACK_LAYERS = 3;
const PULSE_MS = 600;

type Props = {
  discardTop?: CardView;
  highlightDiscard: boolean;
  onStockPress: () => void;
  onDiscardPress: () => void;
  onDiscardMeasure: (rect: Rect) => void;
  onStockMeasure: (rect: Rect) => void;
};

function tiltFor(id: string, layer: number) {
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), layer * 7);
  return (seed % 9) - 4;
}

export function Piles({ discardTop, highlightDiscard, onStockPress, onDiscardPress, onDiscardMeasure, onStockMeasure }: Props) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.set(highlightDiscard ? withRepeat(withTiming(1, { duration: PULSE_MS }), -1, true) : withTiming(0, { duration: 150 }));
  }, [highlightDiscard, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <View style={styles.piles}>
      <Measured onMeasure={onStockMeasure}>
        <Pressable onPress={onStockPress} style={styles.stock}>
          {Array.from({ length: STACK_LAYERS }, (_, layer) => (
            <View key={layer} style={[styles.stockLayer, { top: layer * -2, left: layer * 1 }]}>
              <CardBack width={CARD_WIDTH} />
            </View>
          ))}
        </Pressable>
      </Measured>

      <Pressable onPress={onDiscardPress}>
        <Measured onMeasure={onDiscardMeasure} style={styles.discard}>
          {discardTop && (
            <>
              <View style={[styles.under, { transform: [{ rotate: `${tiltFor(discardTop.id, 1)}deg` }] }]} />
              <View style={[styles.under, { transform: [{ rotate: `${tiltFor(discardTop.id, 2)}deg` }] }]} />
              <Card card={discardTop} width={CARD_WIDTH} />
            </>
          )}
          {!discardTop && <View style={styles.empty} />}
          <Animated.View pointerEvents="none" style={[styles.pulse, pulseStyle]} />
        </Measured>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  piles: { alignItems: "center", gap: 4, width: CARD_WIDTH * CARD_RATIO + 8 },
  stock: { width: CARD_WIDTH * CARD_RATIO, height: CARD_WIDTH + 6, transform: [{ rotate: "90deg" }], alignItems: "center", justifyContent: "center" },
  stockLayer: { position: "absolute" },
  discard: { width: CARD_WIDTH, height: CARD_WIDTH * CARD_RATIO, marginTop: 4 },
  under: { position: "absolute", width: CARD_WIDTH, height: CARD_WIDTH * CARD_RATIO, borderRadius: CARD_WIDTH * 0.1, backgroundColor: "#F4F1EA", borderWidth: 1, borderColor: "#9A9A9A" },
  empty: { width: CARD_WIDTH, height: CARD_WIDTH * CARD_RATIO, borderRadius: 5, borderWidth: 1, borderColor: colors.cream, borderStyle: "dashed" },
  pulse: { ...StyleSheet.absoluteFill, borderRadius: CARD_WIDTH * 0.1, borderWidth: 3, borderColor: colors.highlight, margin: -4 },
});
