import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Asset } from "expo-asset";
import { Client, CloseCode, type Room } from "@colyseus/sdk";
import { ROOM_NAME, type PontinhoState } from "@pontinho/protocol";
import { CardStyleContext, type CardStyleName } from "../cards/Card";
import { DECK_IMAGES } from "../cards/deck";
import { Game } from "../game/Game";
import { PreRoom, type MatchSettings } from "../game/PreRoom";
import { SuitPattern } from "../ui/SuitPattern";
import { WoodButton } from "../ui/WoodButton";
import { colors } from "../table/colors";

const client = new Client(process.env.EXPO_PUBLIC_SERVER_URL);

export default function Index() {
  const [name] = useState(() => `Jogador ${Math.floor(1000 + Math.random() * 9000)}`);
  const [configuring, setConfiguring] = useState(false);
  const [cardStyle, setCardStyle] = useState<CardStyleName>("jumbo");
  const [room, setRoom] = useState<Room<PontinhoState>>();
  const [error, setError] = useState("");

  async function play(settings: MatchSettings) {
    setCardStyle(settings.cardStyle);
    try {
      await Asset.loadAsync(Object.values(DECK_IMAGES[settings.cardStyle]));
      const joined = await client.joinOrCreate<PontinhoState>(ROOM_NAME, { name, seats: settings.seats, bots: settings.bots });
      joined.onLeave((code) => {
        if (code === CloseCode.CONSENTED) {
          return;
        }
        setRoom(undefined);
        setError("A conexão com a sala foi encerrada");
      });
      setConfiguring(false);
      setRoom(joined);
    } catch {
      setError("Não foi possível entrar na sala");
    }
  }

  function exit() {
    room?.leave();
    setRoom(undefined);
  }

  if (room) {
    return (
      <CardStyleContext value={cardStyle}>
        <Game room={room} onExit={exit} />
      </CardStyleContext>
    );
  }

  return (
    <View style={styles.screen}>
      <SuitPattern />
      <SafeAreaView style={styles.content}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>Pontinho</Text>
        </View>
        {configuring ? (
          <PreRoom onConfirm={play} onBack={() => setConfiguring(false)} />
        ) : (
          <WoodButton title="Jogar" onPress={() => setConfiguring(true)} large />
        )}
        <Text style={styles.error}>{error}</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.lobby },
  content: { flex: 1, justifyContent: "center", alignItems: "center", gap: 20, padding: 32 },
  logo: { backgroundColor: colors.felt, backgroundImage: colors.feltGradient, borderWidth: 4, borderColor: colors.woodDark, borderRadius: 16, paddingVertical: 18, paddingHorizontal: 32, marginBottom: 24 },
  logoText: { color: colors.cream, fontSize: 40, fontWeight: "500" },
  error: { color: colors.red, fontSize: 15, minHeight: 20 },
});
