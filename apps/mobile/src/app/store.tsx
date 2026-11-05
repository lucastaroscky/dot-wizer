import { ChipStore } from "@/features/store/ChipStore";
import { usePurchase } from "@/features/store/usePurchase";
import { useQuote } from "@/features/store/useQuote";
import { BalanceCard } from "@/features/wallet/BalanceCard";
import { useWallet } from "@/features/wallet/useWallet";
import { goBackOrHome } from "@/shared/navigation/goBackOrHome";
import { Notice } from "@/shared/ui/Notice";
import { Screen } from "@/shared/ui/Screen";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import store from "@/messages/store.json";

export default function Store() {
  const { balance } = useWallet();
  const quote = useQuote();
  const purchase = usePurchase();

  return (
    <Screen>
      <ScreenHeader title={store.buyChips} backLabel={store.back} onBack={goBackOrHome}>
        <BalanceCard balance={balance} />
      </ScreenHeader>
      {quote.error !== "" && <Notice text={quote.error} tone="danger" onRetry={quote.retry} />}
      {purchase.error !== "" && <Notice text={purchase.error} tone="danger" />}
      <ChipStore quote={quote} purchase={purchase} />
    </Screen>
  );
}
