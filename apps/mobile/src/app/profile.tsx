import { useSignOut } from "@/features/auth/useSignOut";
import { ProfileScreen } from "@/features/profile/ProfileScreen";
import { useWallet } from "@/features/wallet/useWallet";

export default function Profile() {
  const { balance } = useWallet();
  const signOut = useSignOut();

  return <ProfileScreen balance={balance} signOut={signOut} />;
}
