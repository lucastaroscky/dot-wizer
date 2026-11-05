import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View, type HostInstance } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Card, CardBack, type CardView, CARD_RATIO } from "@/shared/cards/Card";
import { Icon } from "@/shared/ui/Icon";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import match from "@/messages/match.json";
import type { Rect } from "./areas";
import { Measured } from "./Measured";
import { cardText } from "./state";

const CARD_WIDTH = 50;
const FLIPPED_WIDTH = 44;
const FLIPPED_OVERHANG = 30;
const STOCK_HEIGHT = CARD_WIDTH + 6;
const SEAL_OVERFLOW = 12;
const FLIPPED_TOP = (STOCK_HEIGHT - CARD_WIDTH * CARD_RATIO) / 2 - FLIPPED_OVERHANG;
const STACK_LAYERS = 3;
const PULSE_MS = 600;

type Props = {
  flipped?: CardView;
  lifeJokers?: string;
  discardTop?: CardView;
  highlightDiscard: boolean;
  onStockPress: () => void;
  onDiscardPress: () => void;
  onDiscardMeasure: (rect: Rect) => void;
  onDiscardView: (view: HostInstance | null) => void;
  onStockMeasure: (rect: Rect) => void;
};

function tiltFor(id: string, layer: number) {
  const seed = [...id].reduce((sum, char) => sum + char.charCodeAt(0), layer * 7);
  return (seed % 9) - 4;
}

export function Piles({ flipped, lifeJokers, discardTop, highlightDiscard, onStockPress, onDiscardPress, onDiscardMeasure, onDiscardView, onStockMeasure }: Props) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.set(highlightDiscard ? withRepeat(withTiming(1, { duration: PULSE_MS }), -1, true) : withTiming(0, { duration: 150 }));
  }, [highlightDiscard, pulse]);

  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.get() }));

  return (
    <View style={[styles.piles, flipped && styles.pilesWithFlipped]}>
      <Measured onMeasure={onStockMeasure}>
        {flipped && (
          <View accessible accessibilityLabel={match.a11y.flipped.replace("{card}", cardText(flipped))} style={styles.flipped}>
            <Card card={flipped} width={FLIPPED_WIDTH} />
          </View>
        )}
        <Pressable onPress={onStockPress} style={styles.stock}>
          {Array.from({ length: STACK_LAYERS }, (_, layer) => (
            <View key={layer} style={[styles.stockLayer, { top: layer * -2, left: layer * 1 }]}>
              <CardBack width={CARD_WIDTH} />
            </View>
          ))}
        </Pressable>
      </Measured>

      {lifeJokers && (
        <View accessible accessibilityLabel={match.a11y.lifeJokers.replace("{cards}", lifeJokers)} style={styles.seal}>
          <Icon name="star" size={10} color={colors.action} />
          <Text style={styles.sealText} numberOfLines={1}>
            {lifeJokers}
          </Text>
        </View>
      )}

      <Pressable onPress={onDiscardPress}>
        <Measured onMeasure={onDiscardMeasure} onView={onDiscardView} style={styles.discard}>
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
  pilesWithFlipped: { paddingTop: -FLIPPED_TOP },
  stock: { width: CARD_WIDTH * CARD_RATIO, height: STOCK_HEIGHT, transform: [{ rotate: "90deg" }], alignItems: "center", justifyContent: "center" },
  stockLayer: { position: "absolute" },
  flipped: { position: "absolute", left: (CARD_WIDTH * CARD_RATIO - FLIPPED_WIDTH) / 2, top: FLIPPED_TOP },
  seal: { marginHorizontal: -SEAL_OVERFLOW, height: 22, paddingHorizontal: 8, borderRadius: 11, borderWidth: 1, borderColor: colors.action, backgroundColor: colors.night, flexDirection: "row", alignItems: "center", gap: 4 },
  sealText: { color: colors.onSelected, fontSize: 11.5, fontFamily: fonts.display },
  discard: { width: CARD_WIDTH, height: CARD_WIDTH * CARD_RATIO, marginTop: 4 },
  under: { position: "absolute", width: CARD_WIDTH, height: CARD_WIDTH * CARD_RATIO, borderRadius: CARD_WIDTH * 0.1, backgroundColor: "#F4F1EA", borderWidth: 1, borderColor: "#9A9A9A" },
  empty: { width: CARD_WIDTH, height: CARD_WIDTH * CARD_RATIO, borderRadius: 5, borderWidth: 1, borderColor: "#3A6A4E", borderStyle: "dashed" },
  pulse: { ...StyleSheet.absoluteFill, borderRadius: CARD_WIDTH * 0.1, borderWidth: 3, borderColor: colors.action, margin: -4 },
});
