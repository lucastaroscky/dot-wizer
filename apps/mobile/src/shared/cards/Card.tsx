import { createContext, useContext } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { colors } from "@/shared/theme/colors";
import { DECK_IMAGES } from "./deck";

export type CardView = { id: string; rank: string; suit: string };

export const CARD_RATIO = 1.4;

export type CardStyleName = keyof typeof DECK_IMAGES;

export const CARD_STYLES: CardStyleName[] = ["jumbo", "zodiac", "cartoon", "neon"];

export const CardStyleContext = createContext<CardStyleName>("jumbo");

type Props = { card: CardView; width: number; selected?: boolean };

export function Card({ card, width, selected = false }: Props) {
  const images = DECK_IMAGES[useContext(CardStyleContext)];
  const key = card.rank === "JOKER" ? "joker" : `${card.rank}-${card.suit}`;
  const size = { width, height: width * CARD_RATIO, borderRadius: width * 0.06 };

  return (
    <View style={[styles.card, size]}>
      <Image source={images[key]} draggable={false} style={StyleSheet.absoluteFill} />
      {selected && <View style={[styles.selected, { borderRadius: size.borderRadius }]} />}
    </View>
  );
}

export function CardBack({ width }: { width: number }) {
  const images = DECK_IMAGES[useContext(CardStyleContext)];

  return (
    <View style={[styles.card, { width, height: width * CARD_RATIO, borderRadius: width * 0.06 }]}>
      <Image source={images.back} draggable={false} style={StyleSheet.absoluteFill} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { overflow: "hidden", boxShadow: "0 1px 3px rgba(0, 0, 0, 0.4)" },
  selected: { ...StyleSheet.absoluteFill, backgroundColor: colors.selectTint, borderWidth: 2, borderColor: colors.highlight },
});
