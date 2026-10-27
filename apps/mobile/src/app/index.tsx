import { router } from "expo-router";
import { useMatch } from "@/features/match/MatchProvider";
import { MenuScreen } from "@/shared/ui/MenuScreen";
import { WoodButton } from "@/shared/ui/WoodButton";
import home from "@/messages/home.json";

export default function Home() {
  const { error } = useMatch();

  return (
    <MenuScreen title={home.title} error={error}>
      <WoodButton title={home.play} onPress={() => router.push("/lobby")} large />
    </MenuScreen>
  );
}
