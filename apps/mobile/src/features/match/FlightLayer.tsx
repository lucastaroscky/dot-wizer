import { useEffect, useRef, useState } from "react";
import { StyleSheet, View, type HostInstance } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { Card, CardBack, type CardView, CARD_RATIO } from "@/shared/cards/Card";
import type { Rect } from "./areas";

const CARD_WIDTH = 50;
const FLIGHT_MS = 450;

export type Flight = { id: number; card?: CardView; from: Rect; to: Rect; delay: number };

type Props = { flights: Flight[]; onLanded: (id: number) => void };

export function FlightLayer({ flights, onLanded }: Props) {
  const ref = useRef<HostInstance>(null);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });

  function measure() {
    ref.current?.measureInWindow((x, y) => setOrigin({ x, y }));
  }

  return (
    <View ref={ref} onLayout={measure} pointerEvents="none" style={StyleSheet.absoluteFill}>
      {flights.map((flight) => (
        <FlyingCard key={flight.id} flight={flight} origin={origin} onLanded={onLanded} />
      ))}
    </View>
  );
}

function centerOf(rect: Rect) {
  return { x: rect.x + rect.width / 2 - CARD_WIDTH / 2, y: rect.y + rect.height / 2 - (CARD_WIDTH * CARD_RATIO) / 2 };
}

function FlyingCard({ flight, origin, onLanded }: { flight: Flight; origin: { x: number; y: number }; onLanded: (id: number) => void }) {
  const progress = useSharedValue(0);
  const start = centerOf(flight.from);
  const end = centerOf(flight.to);

  useEffect(() => {
    progress.set(
      withDelay(
        flight.delay,
        withTiming(1, { duration: FLIGHT_MS, easing: Easing.out(Easing.cubic), reduceMotion: ReduceMotion.Never }, (finished) => {
          if (finished) {
            scheduleOnRN(onLanded, flight.id);
          }
        }),
        ReduceMotion.Never,
      ),
    );
  }, [flight, onLanded, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.get() === 0 ? 0 : 1,
    transform: [
      { translateX: (end.x - start.x) * progress.get() },
      { translateY: (end.y - start.y) * progress.get() },
      { rotate: `${(1 - progress.get()) * 12}deg` },
    ],
  }));

  return (
    <Animated.View style={[{ position: "absolute", left: start.x - origin.x, top: start.y - origin.y }, style]}>
      {flight.card ? <Card card={flight.card} width={CARD_WIDTH} /> : <CardBack width={CARD_WIDTH} />}
    </Animated.View>
  );
}
