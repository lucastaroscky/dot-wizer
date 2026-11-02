import { Redirect, router } from "expo-router";
import { DAILY_BONUS } from "@pontinho/rules";
import { useSignOut } from "@/features/auth/useSignOut";
import { useMatch } from "@/features/match/MatchProvider";
import { BalanceCard } from "@/features/wallet/BalanceCard";
import { useDailyBonus } from "@/features/wallet/useDailyBonus";
import { useWallet } from "@/features/wallet/useWallet";
import { MenuScreen } from "@/shared/ui/MenuScreen";
import { WoodButton } from "@/shared/ui/WoodButton";
import home from "@/messages/home.json";
import wallet from "@/messages/wallet.json";

export default function Home() {
  const { room, error: matchError } = useMatch();
  const { balance, dailyBonusAvailable, error: walletError } = useWallet();
  const dailyBonus = useDailyBonus();
  const signOut = useSignOut();
  const bonusTitle = dailyBonusAvailable === false ? wallet.dailyBonusClaimed : wallet.claimDailyBonus.replace("{amount}", String(DAILY_BONUS));

  if (room) {
    return <Redirect href="/match" />;
  }

  return (
    <MenuScreen title={home.title} error={matchError || walletError || dailyBonus.error || signOut.error}>
      <BalanceCard balance={balance} />
      <WoodButton title={bonusTitle} onPress={dailyBonus.claim} disabled={dailyBonusAvailable !== true || dailyBonus.pending} />
      <WoodButton title={home.play} onPress={() => router.push("/lobby")} large />
      <WoodButton title={home.store} onPress={() => router.push("/store")} />
      <WoodButton title={home.signOut} onPress={signOut.signOut} disabled={signOut.pending} />
    </MenuScreen>
  );
}
