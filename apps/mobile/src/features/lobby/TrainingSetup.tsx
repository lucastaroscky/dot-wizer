import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { MIN_PLAYERS, TRAINING_MAX_PLAYERS } from "@pontinho/protocol";
import type { CardStyleName } from "@/shared/cards/Card";
import { Button } from "@/shared/ui/Button";
import { Icon } from "@/shared/ui/Icon";
import { ErrorLine } from "@/shared/ui/Notice";
import { Option, optionTextColor } from "@/shared/ui/Option";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import home from "@/messages/home.json";
import lobby from "@/messages/lobby.json";
import { CardStylePicker } from "./CardStylePicker";
import type { LobbyChoice } from "./PreRoom";

const SEAT_OPTIONS = Array.from({ length: TRAINING_MAX_PLAYERS - MIN_PLAYERS + 1 }, (_, index) => MIN_PLAYERS + index);
const DEFAULT_SEATS = 4;
const JOKER_OPTIONS = [
  { lifeJoker: false, label: lobby.onlyBigJoker, hint: "" },
  { lifeJoker: true, label: lobby.withLifeJoker, hint: lobby.lifeJokerHint },
];

type Props = { connecting: boolean; error: string; onConfirm: (choice: LobbyChoice) => void };

export function TrainingSetup({ connecting, error, onConfirm }: Props) {
  const [lifeJoker, setLifeJoker] = useState(false);
  const [seats, setSeats] = useState(DEFAULT_SEATS);
  const [cardStyle, setCardStyle] = useState<CardStyleName>("jumbo");

  return (
    <>
      <View style={styles.hint}>
        <Icon name="bot" size={16} color={colors.action} />
        <Text style={styles.hintText}>{lobby.trainingHint}</Text>
      </View>
      <View style={styles.group}>
        <Text style={styles.label}>{lobby.joker}</Text>
        {JOKER_OPTIONS.map((option) => {
          const selected = option.lifeJoker === lifeJoker;
          return (
            <Option key={option.label} selected={selected} onPress={() => setLifeJoker(option.lifeJoker)} label={option.label} style={styles.joker}>
              <View style={[styles.dot, selected && styles.dotSelected]} />
              <View style={styles.jokerText}>
                <Text style={[styles.jokerLabel, { color: optionTextColor(selected) }]}>{option.label}</Text>
                {option.hint !== "" && <Text style={[styles.jokerHint, selected && styles.jokerHintSelected]}>{option.hint}</Text>}
              </View>
            </Option>
          );
        })}
      </View>
      <View style={styles.group}>
        <Text style={styles.label}>{lobby.seats}</Text>
        <View style={styles.options}>
          {SEAT_OPTIONS.map((option) => (
            <Option key={option} selected={option === seats} onPress={() => setSeats(option)} label={String(option)} style={styles.seat}>
              <Text style={[styles.seatText, { color: optionTextColor(option === seats) }]}>{option}</Text>
            </Option>
          ))}
        </View>
      </View>
      <CardStylePicker value={cardStyle} onChange={setCardStyle} />
      <View style={styles.footer}>
        <ErrorLine text={error} />
        <Button title={connecting ? lobby.connecting : home.play} onPress={() => onConfirm({ bots: true, seats, lifeJoker, cardStyle })} loading={connecting} />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  hint: { alignSelf: "flex-start", height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, flexDirection: "row", alignItems: "center", gap: 8 },
  hintText: { color: colors.textSoft, fontSize: 13, fontFamily: fonts.semibold },
  group: { gap: 8 },
  label: { color: colors.muted, fontSize: 13, fontFamily: fonts.semibold },
  joker: { minHeight: 56, paddingVertical: 10, paddingHorizontal: 14, flexDirection: "row", justifyContent: "flex-start", gap: 12 },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.faint },
  dotSelected: { borderColor: colors.action, backgroundColor: colors.action },
  jokerText: { flex: 1, gap: 2 },
  jokerLabel: { fontSize: 15, fontFamily: fonts.semibold },
  jokerHint: { color: colors.optionMuted, fontSize: 12.5, lineHeight: 17, fontFamily: fonts.regular },
  jokerHintSelected: { color: colors.optionText },
  options: { flexDirection: "row", gap: 8 },
  seat: { flex: 1, height: 52 },
  seatText: { fontSize: 18, fontFamily: fonts.display },
  footer: { marginTop: "auto", gap: 10 },
});
