import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { Avatar } from "@/shared/ui/Avatar";
import { Icon } from "@/shared/ui/Icon";
import { colors } from "@/shared/theme/colors";
import match from "@/messages/match.json";
import { TurnTimer, type TurnClock } from "./TurnTimer";

type Props = {
  name: string;
  photoUrl?: string;
  points?: number;
  eliminated?: boolean;
  sittingOut?: boolean;
  offline?: boolean;
  isTurn?: boolean;
  turn?: TurnClock;
};

function details(points?: number, eliminated?: boolean, sittingOut?: boolean) {
  if (eliminated) {
    return match.eliminated;
  }
  if (sittingOut) {
    return match.sittingOut;
  }
  if (points === undefined) {
    return undefined;
  }
  return match.points.replace("{points}", String(points));
}

export function PlayerPlate({ name, photoUrl, points, eliminated = false, sittingOut = false, offline = false, isTurn = false, turn }: Props) {
  const scale = useSharedValue(1);
  const info = details(points, eliminated, sittingOut);

  useEffect(() => {
    scale.set(withSpring(isTurn ? 1.06 : 1, { duration: 250, dampingRatio: 0.7 }));
  }, [isTurn, scale]);

  const plateStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <Animated.View style={[plateStyle, styles.plate, isTurn && styles.turn, (eliminated || sittingOut) && styles.dimmed]}>
      <View style={styles.row}>
        <View style={[styles.ring, isTurn && styles.ringTurn]}>
          <Avatar name={name} size={28} photoUrl={photoUrl} />
        </View>
        <View style={styles.text}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          {info && <Text style={styles.info}>{info}</Text>}
          {offline && (
            <View style={styles.offline}>
              <Icon name="offline" size={10} color={colors.textSoft} />
              <Text style={styles.offlineText}>{match.offline}</Text>
            </View>
          )}
        </View>
      </View>
      {turn && isTurn && <TurnTimer duration={turn.duration} turnNumber={turn.number} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  plate: { width: 112, padding: 8, gap: 7, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: "#0E1512" },
  turn: { borderColor: colors.action },
  dimmed: { opacity: 0.45 },
  row: { flexDirection: "row", alignItems: "center", gap: 7 },
  ring: { borderRadius: 16, borderWidth: 2, borderColor: "transparent" },
  ringTurn: { borderColor: colors.action },
  text: { flex: 1, gap: 2 },
  name: { color: colors.text, fontSize: 13, fontWeight: "600" },
  info: { color: colors.muted, fontSize: 11 },
  offline: { alignSelf: "flex-start", height: 17, paddingHorizontal: 5, borderRadius: 9, borderWidth: 1, borderColor: colors.lineStrong, flexDirection: "row", alignItems: "center", gap: 3 },
  offlineText: { color: colors.textSoft, fontSize: 10, fontWeight: "600" },
});
