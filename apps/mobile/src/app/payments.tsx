import { PaymentsScreen } from "@/features/store/PaymentsScreen";
import { BalanceCard } from "@/features/wallet/BalanceCard";
import { useWallet } from "@/features/wallet/useWallet";

export default function Payments() {
  const wallet = useWallet();

  return <PaymentsScreen balanceCard={<BalanceCard balance={wallet.balance} />} walletError={wallet.error} onRetryWallet={wallet.retry} />;
}
