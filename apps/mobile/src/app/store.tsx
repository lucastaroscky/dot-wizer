import { ChipStore } from "@/features/store/ChipStore";
import { usePurchase } from "@/features/store/usePurchase";
import { useQuote } from "@/features/store/useQuote";
import { BalanceCard } from "@/features/wallet/BalanceCard";
import { useWallet } from "@/features/wallet/useWallet";
import { goBackOrHome } from "@/shared/navigation/goBackOrHome";
import { Button } from "@/shared/ui/Button";
import { Notice } from "@/shared/ui/Notice";
import { Screen } from "@/shared/ui/Screen";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import home from "@/messages/home.json";
import store from "@/messages/store.json";

export default function Store() {
  const { balance } = useWallet();
  const quote = useQuote();
  const purchase = usePurchase();
  const error = quote.error || purchase.error;

  return (
    <Screen>
      <ScreenHeader title={home.store} backLabel={store.back} onBack={goBackOrHome}>
        <BalanceCard balance={balance} />
      </ScreenHeader>
      {error !== "" && <Notice text={error} tone="danger" />}
      <ChipStore quote={quote} purchase={purchase} />
      <Button title={store.back} onPress={goBackOrHome} variant="secondary" />
    </Screen>
  );
}
