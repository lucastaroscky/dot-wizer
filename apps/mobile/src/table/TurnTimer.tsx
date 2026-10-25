import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, ReduceMotion, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { colors } from "./colors";

const TURN_MS = 30_000;

export function TurnTimer({ deadline }: { deadline: number }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (deadline === 0) {
      progress.value = 0;
      return;
    }
    const remaining = Math.min(Math.max(deadline - Date.now(), 0), TURN_MS);
    progress.value = remaining / TURN_MS;
    progress.value = withTiming(0, { duration: remaining, easing: Easing.linear, reduceMotion: ReduceMotion.Never });
  }, [deadline, progress]);

  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));

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
