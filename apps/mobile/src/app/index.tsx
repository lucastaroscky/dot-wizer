import { Pressable, StyleSheet, Text, View } from "react-native";
import { Redirect, router } from "expo-router";
import { useSignOut } from "@/features/auth/useSignOut";
import { useMatch } from "@/features/match/MatchProvider";
import { BalanceCard } from "@/features/wallet/BalanceCard";
import { DailyBonus } from "@/features/wallet/DailyBonus";
import { useDailyBonus } from "@/features/wallet/useDailyBonus";
import { useWallet } from "@/features/wallet/useWallet";
import { CardTrio } from "@/shared/ui/CardTrio";
import { Icon } from "@/shared/ui/Icon";
import { Logo } from "@/shared/ui/Logo";
import { Notice } from "@/shared/ui/Notice";
import { Screen } from "@/shared/ui/Screen";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import home from "@/messages/home.json";

export default function Home() {
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
      <Pressable onPress={() => router.push("/lobby")} accessibilityRole="button" style={({ pressed }) => [styles.play, pressed && styles.pressed]}>
        <View style={styles.playCards}>
          <CardTrio width={56} />
        </View>
        <View style={styles.playRow}>
          <Text style={styles.playTitle}>{home.play}</Text>
          <View style={styles.playArrow}>
            <Icon name="forward" size={22} color={colors.onAction} />
          </View>
        </View>
      </Pressable>
      <Pressable onPress={() => router.push("/store")} accessibilityRole="button" style={({ pressed }) => [styles.store, pressed && styles.pressed]}>
        <Icon name="store" size={22} color={colors.text} />
        <Text style={styles.storeText}>{home.store}</Text>
        <Icon name="chevron" size={18} color={colors.faint} />
      </Pressable>
      <Pressable onPress={signOut.signOut} disabled={signOut.pending} accessibilityRole="button" style={styles.signOut}>
        <Icon name="signOut" size={18} color={colors.muted} />
        <Text style={styles.signOutText}>{home.signOut}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { height: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pressed: { opacity: 0.85 },
  play: { height: 260, padding: 22, borderRadius: 24, overflow: "hidden", backgroundColor: colors.feltNight, backgroundImage: colors.feltCard, justifyContent: "flex-end" },
  playCards: { position: "absolute", right: 36, top: 30 },
  playRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  playTitle: { color: colors.text, fontSize: 28, fontFamily: fonts.display },
  playArrow: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.action, alignItems: "center", justifyContent: "center" },
  store: { height: 68, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 14 },
  storeText: { flex: 1, color: colors.text, fontSize: 16, fontFamily: fonts.semibold },
  signOut: { marginTop: "auto", alignSelf: "center", height: 44, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 8 },
  signOutText: { color: colors.muted, fontSize: 15, fontFamily: fonts.semibold },
});
