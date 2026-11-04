import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Room } from "@colyseus/sdk";
import type { PontinhoState } from "@pontinho/protocol";
import { returnPoints } from "@pontinho/rules";
import { Button } from "@/shared/ui/Button";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import match from "@/messages/match.json";
import { sendAction } from "./messaging";
import type { GameState } from "./state";
import { TurnTimer } from "./TurnTimer";

type Props = { room: Room<PontinhoState>; state: GameState };

const TICK_MS = 250;

function SecondsLeft({ duration }: { duration: number }) {
  const [endsAt] = useState(() => Date.now() + duration);
  const [now, setNow] = useState(endsAt - duration);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const seconds = Math.max(Math.ceil((endsAt - now) / 1000), 0);
  return <Text style={styles.seconds}>{match.returnPrompt.secondsLeft.replace("{seconds}", String(seconds))}</Text>;
}

export function ReturnPrompt({ room, state }: Props) {
  return (
    <View style={styles.prompt}>
      <Text style={styles.title}>{match.returnPrompt.title}</Text>
      <Text style={styles.detail}>{match.returnPrompt.returnsWith.replace("{points}", String(returnPoints(Object.values(state.players))))}</Text>
      <View style={styles.actions}>
        <View style={styles.action}>
          <Button title={match.returnPrompt.back} onPress={() => sendAction(room, "chooseReturn", { back: true })} />
        </View>
        <View style={styles.action}>
          <Button title={match.returnPrompt.leave} onPress={() => sendAction(room, "chooseReturn", { back: false })} variant="secondary" />
        </View>
      </View>
      <View style={styles.timer}>
        <View style={styles.bar}>
          <TurnTimer duration={state.returnDuration} turnNumber={state.returnNumber} />
        </View>
        <SecondsLeft key={state.returnNumber} duration={state.returnDuration} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  prompt: { paddingVertical: 18, paddingHorizontal: 16, gap: 12, borderRadius: 24, borderWidth: 1, borderColor: colors.action, backgroundColor: colors.surface },
  title: { color: colors.text, fontSize: 18, fontFamily: fonts.display },
  detail: { marginTop: -4, color: colors.muted, fontSize: 14, fontFamily: fonts.regular },
  actions: { flexDirection: "row", gap: 10 },
  action: { flex: 1 },
  timer: { flexDirection: "row", alignItems: "center", gap: 10 },
  bar: { flex: 1 },
  seconds: { color: colors.muted, fontSize: 12, fontFamily: fonts.regular, fontVariant: ["tabular-nums"] },
});
