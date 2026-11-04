import { StyleSheet, Text, View } from "react-native";
import { Button } from "@/shared/ui/Button";
import { Icon } from "@/shared/ui/Icon";
import { Notice } from "@/shared/ui/Notice";
import { Screen } from "@/shared/ui/Screen";
import { colors } from "@/shared/theme/colors";
import match from "@/messages/match.json";
import { MatchHistory } from "./MatchHistory";

type Props = { matchId: string; userId?: string; aborted: boolean; title: string; onExit: () => void };

export function MatchEnd({ matchId, userId, aborted, title, onExit }: Props) {
  return (
    <Screen>
      {aborted ? (
        <Notice text={title} tone="danger" />
      ) : (
        <View style={styles.winner}>
          <View style={styles.trophy}>
            <Icon name="trophy" size={24} color={colors.onAction} />
          </View>
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
        </View>
      )}
      <Text style={styles.subtitle}>{match.history.title}</Text>
      <MatchHistory matchId={matchId} userId={userId} polling={!aborted} />
      <View style={styles.footer}>
        <Button title={match.back} onPress={onExit} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  winner: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 8 },
  trophy: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.action, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, color: colors.text, fontSize: 21, lineHeight: 26, fontWeight: "600" },
  subtitle: { color: colors.textSoft, fontSize: 15, fontWeight: "600" },
  footer: { marginTop: "auto" },
});
