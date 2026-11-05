import { useSession } from "@/features/auth/SessionProvider";
import { useSignOut } from "@/features/auth/useSignOut";
import { ProfileScreen } from "@/features/profile/ProfileScreen";
import { useWallet } from "@/features/wallet/useWallet";

export default function Profile() {
  const { session } = useSession();
  const { balance } = useWallet();
  const signOut = useSignOut();
  const signedInWithGoogle = session?.user.app_metadata.providers?.includes("google") ?? false;

  return <ProfileScreen balance={balance} canChangeEmail={!signedInWithGoogle} signOut={signOut} />;
}
