import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Avatar } from "@/shared/ui/Avatar";
import { colors } from "@/shared/theme/colors";
import match from "@/messages/match.json";
import { TurnTimer, type TurnClock } from "./TurnTimer";

type Props = { name: string; points?: number; eliminated?: boolean; isTurn?: boolean; turn?: TurnClock };

function details(points?: number, eliminated?: boolean) {
  if (eliminated) {
    return match.eliminated;
  }
  if (points === undefined) {
    return undefined;
  }
  return match.points.replace("{points}", String(points));
}

export function PlayerPlate({ name, points, eliminated = false, isTurn = false, turn }: Props) {
  const scale = useSharedValue(1);
  const info = details(points, eliminated);

  useEffect(() => {
    scale.set(withSpring(isTurn ? 1.06 : 1, { duration: 250, dampingRatio: 0.7 }));
  }, [isTurn, scale]);

  const plateStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={[styles.container, plateStyle, eliminated && styles.eliminated]}>
      <View style={[styles.frame, isTurn && styles.turn]}>
        <View style={styles.plate}>
          <Avatar name={name} size={26} />
          <View>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {info && <Text style={styles.info}>{info}</Text>}
          </View>
        </View>
      </View>
      {turn && <TurnTimer duration={isTurn ? turn.duration : 0} turnNumber={turn.number} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { minWidth: 104 },
  eliminated: { opacity: 0.5 },
  frame: { backgroundColor: colors.woodDark, borderRadius: 8, padding: 2, boxShadow: "0 2px 4px rgba(0, 0, 0, 0.4)" },
  turn: { backgroundColor: colors.highlight },
  plate: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundImage: colors.woodGradient,
    borderWidth: 1,
    borderColor: colors.woodLight,
    borderRadius: 6,
    paddingVertical: 3,
    paddingLeft: 4,
    paddingRight: 10,
  },
  name: { color: colors.woodText, fontSize: 13, fontWeight: "700", maxWidth: 110 },
  info: { color: colors.woodText, fontSize: 11 },
});
