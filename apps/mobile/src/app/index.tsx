import { Redirect, router } from "expo-router";
import { DAILY_BONUS } from "@pontinho/rules";
import { useSignOut } from "@/features/auth/useSignOut";
import { OpenMatchPrompt } from "@/features/lobby/OpenMatchPrompt";
import { useMatch } from "@/features/match/MatchProvider";
import { BalanceCard } from "@/features/wallet/BalanceCard";
import { useDailyBonus } from "@/features/wallet/useDailyBonus";
import { useWallet } from "@/features/wallet/useWallet";
import { MenuScreen } from "@/shared/ui/MenuScreen";
import { WoodButton } from "@/shared/ui/WoodButton";
import home from "@/messages/home.json";
import wallet from "@/messages/wallet.json";

export default function Home() {
  const { room, connecting, error: matchError, openMatch, canResume, resume, dismissOpenMatch } = useMatch();
  const { balance, dailyBonusAvailable, loading, error: walletError } = useWallet();
  const dailyBonus = useDailyBonus();
  const signOut = useSignOut();
  const bonusTitle = dailyBonusAvailable || loading ? wallet.claimDailyBonus.replace("{amount}", String(DAILY_BONUS)) : wallet.dailyBonusClaimed;

  if (room) {
    return <Redirect href="/match" />;
  }
  if (openMatch) {
    return (
      <MenuScreen title={home.title} error={matchError}>
        <OpenMatchPrompt canResume={canResume} connecting={connecting} onResume={resume} onBack={dismissOpenMatch} />
      </MenuScreen>
    );
  }

  return (
    <MenuScreen title={home.title} error={matchError || walletError || dailyBonus.error || signOut.error}>
      <BalanceCard balance={balance} />
      <WoodButton title={bonusTitle} onPress={dailyBonus.claim} disabled={!dailyBonusAvailable || dailyBonus.pending} />
      <WoodButton title={home.play} onPress={() => router.push("/lobby")} large />
      <WoodButton title={home.store} onPress={() => router.push("/store")} />
      <WoodButton title={home.signOut} onPress={signOut.signOut} disabled={signOut.pending} />
    </MenuScreen>
  );
}
