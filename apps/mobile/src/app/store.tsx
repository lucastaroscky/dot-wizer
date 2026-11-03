import { ChipStore } from "@/features/store/ChipStore";
import { usePurchase } from "@/features/store/usePurchase";
import { useQuote } from "@/features/store/useQuote";
import { BalanceCard } from "@/features/wallet/BalanceCard";
import { useWallet } from "@/features/wallet/useWallet";
import { goBackOrHome } from "@/shared/navigation/goBackOrHome";
import { MenuScreen } from "@/shared/ui/MenuScreen";
import { WoodButton } from "@/shared/ui/WoodButton";
import home from "@/messages/home.json";
import store from "@/messages/store.json";

export default function Store() {
  const { balance } = useWallet();
  const quote = useQuote();
  const purchase = usePurchase();

  return (
    <MenuScreen title={home.title} error={quote.error || purchase.error}>
      <BalanceCard balance={balance} />
      <ChipStore quote={quote} purchase={purchase} />
      <WoodButton title={store.back} onPress={goBackOrHome} />
    </MenuScreen>
  );
}
