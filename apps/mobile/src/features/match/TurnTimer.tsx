import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors } from "@/shared/theme/colors";

export type TurnClock = { duration: number; number: number };

type Props = { duration: number; turnNumber: number };

export function TurnTimer({ duration, turnNumber }: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (duration === 0) {
      progress.set(0);
      return;
    }
    progress.set(1);
    progress.set(withTiming(0, { duration, easing: Easing.linear, reduceMotion: ReduceMotion.Never }));
  }, [duration, turnNumber, progress]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }));

  return (
    <View style={styles.track}>
      <Animated.View style={[styles.bar, barStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, width: "100%", backgroundColor: "rgba(0, 0, 0, 0.4)", borderRadius: 3, marginTop: 4, overflow: "hidden" },
  bar: { height: 6, width: "100%", borderRadius: 3, backgroundColor: colors.highlight, transformOrigin: "left" },
});
