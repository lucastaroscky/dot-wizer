import { createContext, useContext } from "react";
import { StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { cardById, isJoker, type Wild } from "@pontinho/rules";
import { colors } from "@/shared/theme/colors";
import { Icon } from "@/shared/ui/Icon";
import { DECK_IMAGES } from "./deck";

export type CardView = { id: string; rank: string; suit: string };

export const CARD_RATIO = 1.4;

export type CardStyleName = keyof typeof DECK_IMAGES;

export const CARD_STYLES: CardStyleName[] = ["jumbo", "zodiac", "cartoon", "neon"];

export const CardStyleContext = createContext<CardStyleName>("jumbo");

export const WildContext = createContext<Wild | undefined>(undefined);

const MARK_LEFT = 0.32;
const MARK_TOP = 0.05;
const MARK_SIZE = 0.25;

type Props = { card: CardView; width: number; selected?: boolean };

export function Card({ card, width, selected = false }: Props) {
  const images = DECK_IMAGES[useContext(CardStyleContext)];
  const key = card.rank === "JOKER" ? "joker" : `${card.rank}-${card.suit}`;
  const size = { width, height: width * CARD_RATIO, borderRadius: width * 0.06 };
  const wild = useContext(WildContext);
  const lifeJoker = card.rank !== "JOKER" && isJoker(cardById(card.id), wild);
  const markSize = width * MARK_SIZE;

  return (
    <View style={[styles.card, size, selected && styles.selected]}>
      <Image source={images[key]} draggable={false} style={StyleSheet.absoluteFill} />
      {lifeJoker && (
        <View style={[styles.mark, { left: width * MARK_LEFT, top: width * MARK_TOP, width: markSize, height: markSize, borderRadius: markSize / 2 }]}>
          <Icon name="star" size={markSize * 0.6} color={colors.action} />
        </View>
      )}
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
  mark: { position: "absolute", borderWidth: 1.5, borderColor: colors.action, backgroundColor: colors.night, alignItems: "center", justifyContent: "center" },
  selected: { boxShadow: `0 0 0 2px ${colors.onSelected}, 0 0 0 4.5px ${colors.selected}, 0 10px 22px rgba(0, 0, 0, 0.55)` },
});
