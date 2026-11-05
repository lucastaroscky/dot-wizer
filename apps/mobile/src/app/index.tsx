import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useSignOut } from "@/features/auth/useSignOut";
import { useMatch } from "@/features/match/MatchProvider";
import { BalanceCard } from "@/features/wallet/BalanceCard";
import { DailyBonus } from "@/features/wallet/DailyBonus";
import { useDailyBonus } from "@/features/wallet/useDailyBonus";
import { useWallet } from "@/features/wallet/useWallet";
import { CardTrio } from "@/shared/ui/CardTrio";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { Logo } from "@/shared/ui/Logo";
import { Notice } from "@/shared/ui/Notice";
import { Screen } from "@/shared/ui/Screen";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import home from "@/messages/home.json";

export default function Menu() {
  const { room, error: matchError } = useMatch();
  const wallet = useWallet();
  const dailyBonus = useDailyBonus();
  const signOut = useSignOut();
  const error = matchError || dailyBonus.error || signOut.error;

  if (room) {
    return <Redirect href="/match" />;
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Logo size={22} />
        <BalanceCard balance={wallet.balance} />
      </View>
      {wallet.error !== "" && <Notice text={wallet.error} tone="danger" onRetry={wallet.retry} />}
      {error !== "" && <Notice text={error} tone="danger" />}
      <DailyBonus available={wallet.dailyBonusAvailable} pending={dailyBonus.pending} onClaim={dailyBonus.claim} />
      <Pressable onPress={() => router.push("/lobby")} accessibilityRole="button" style={({ pressed }) => [styles.online, pressed && styles.pressed]}>
        <View style={styles.onlineCards}>
          <CardTrio width={56} />
        </View>
        <Text style={styles.onlineTitle}>{home.playOnline}</Text>
        <View style={styles.onlineRow}>
          <Text style={styles.onlineHint}>{home.playOnlineHint}</Text>
          <View style={styles.onlineArrow}>
            <Icon name="forward" size={22} color={colors.onAction} />
          </View>
        </View>
      </Pressable>
      <Pressable onPress={() => router.push("/lobby")} accessibilityRole="button" style={({ pressed }) => [styles.practice, pressed && styles.pressed]}>
        <View style={styles.practiceIcon}>
          <Icon name="bot" size={24} color={colors.text} />
        </View>
        <View style={styles.practiceText}>
          <Text style={styles.practiceTitle}>{home.play}</Text>
          <Text style={styles.hint}>{home.practiceHint}</Text>
        </View>
        <Icon name="chevron" size={18} color={colors.faint} />
      </Pressable>
      <View accessibilityRole="menu" style={styles.list}>
        <Pressable onPress={() => router.push("/store")} accessibilityRole="button" style={({ pressed }) => [styles.listRow, pressed && styles.pressed]}>
          <Icon name="payments" size={22} color={colors.text} />
          <View style={styles.listText}>
            <Text style={styles.listTitle}>{home.payments}</Text>
            <Text style={styles.hint}>{home.paymentsHint}</Text>
          </View>
          <Icon name="chevron" size={18} color={colors.faint} />
        </Pressable>
      </View>
      <View style={styles.soon}>
        <ComingSoon icon="book" title={home.howToPlay} />
        <ComingSoon icon="trophy" title={home.ranking} />
      </View>
      <Pressable onPress={signOut.signOut} disabled={signOut.pending} accessibilityRole="button" style={styles.signOut}>
        <Icon name="signOut" size={18} color={colors.muted} />
        <Text style={styles.signOutText}>{home.signOut}</Text>
      </Pressable>
    </Screen>
  );
}

function ComingSoon({ icon, title }: { icon: IconName; title: string }) {
  return (
    <View aria-disabled style={styles.soonItem}>
      <Icon name={icon} size={18} color={colors.optionMuted} />
      <Text style={styles.soonTitle}>{title}</Text>
      <Text style={styles.soonTag}>{home.comingSoon}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pressed: { opacity: 0.85 },
  online: { height: 210, padding: 20, gap: 4, borderRadius: 24, overflow: "hidden", backgroundColor: colors.feltNight, backgroundImage: colors.feltCard, justifyContent: "flex-end" },
  onlineCards: { position: "absolute", right: 36, top: 24 },
  onlineTitle: { color: colors.onSelected, fontSize: 26, fontFamily: fonts.display },
  onlineRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  onlineHint: { color: colors.feltText, fontSize: 14, fontFamily: fonts.regular },
  onlineArrow: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.action, alignItems: "center", justifyContent: "center" },
  practice: { height: 80, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 14 },
  practiceIcon: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.option, alignItems: "center", justifyContent: "center" },
  practiceText: { flex: 1, gap: 3 },
  practiceTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.display },
  hint: { color: colors.muted, fontSize: 13, fontFamily: fonts.regular },
  list: { borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  listRow: { height: 66, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  listText: { flex: 1, gap: 2 },
  listTitle: { color: colors.text, fontSize: 16, fontFamily: fonts.semibold },
  soon: { flexDirection: "row", gap: 12 },
  soonItem: { flex: 1, height: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 8 },
  soonTitle: { flex: 1, color: colors.optionMuted, fontSize: 14, fontFamily: fonts.semibold },
  soonTag: { color: colors.optionMuted, fontSize: 11, fontFamily: fonts.regular },
  signOut: { marginTop: "auto", alignSelf: "center", height: 44, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 8 },
  signOutText: { color: colors.muted, fontSize: 15, fontFamily: fonts.semibold },
});
