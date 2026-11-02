import { MenuScreen } from "@/shared/ui/MenuScreen";
import { WoodButton } from "@/shared/ui/WoodButton";
import home from "@/messages/home.json";
import profile from "@/messages/profile.json";

export function ProfileLoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <MenuScreen title={home.title} error={profile.loadFailed}>
      <WoodButton title={profile.retry} onPress={onRetry} large />
    </MenuScreen>
  );
}
