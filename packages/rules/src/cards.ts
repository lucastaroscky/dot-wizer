export const SUITS = ["spades", "hearts", "diamonds", "clubs"] as const;
export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;

export type Suit = (typeof SUITS)[number];
export type Rank = (typeof RANKS)[number];
export type Card = { id: string; rank: Rank; suit: Suit } | { id: string; rank: "JOKER" };

export const HAND_SIZE = 9;
const DECK_COPIES = 2;
const JOKERS_PER_DECK = 2;

export function createDeck(): Card[] {
  const cards: Card[] = [];
  for (let copy = 1; copy <= DECK_COPIES; copy++) {
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        cards.push({ id: `${rank}-${suit}-${copy}`, rank, suit });
      }
    }
    for (let joker = 1; joker <= JOKERS_PER_DECK; joker++) {
      cards.push({ id: `JOKER-${copy}-${joker}`, rank: "JOKER" });
    }
  }
  return cards;
}

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export type Piles = { stock: Card[]; discard: Card[] };
export type Round = Piles & { hands: Card[][] };

export function dealRound(playerCount: number, random = Math.random): Round {
  const stock = shuffle(createDeck(), random);
  const hands = Array.from({ length: playerCount }, () => stock.splice(0, HAND_SIZE));
  const discard = stock.splice(0, 1);
  return { hands, stock, discard };
}

export function drawFromStock({ stock, discard }: Piles, random = Math.random): (Piles & { card: Card }) | undefined {
  if (stock.length === 0 && discard.length <= 1) {
    return undefined;
  }
  if (stock.length === 0) {
    return drawFromStock({ stock: shuffle(discard.slice(0, -1), random), discard: discard.slice(-1) }, random);
  }
  return { card: stock[0], stock: stock.slice(1), discard };
}

const CARD_POINTS: Record<Rank | "JOKER", number> = {
  JOKER: 20, A: 15, K: 10, Q: 10, J: 10,
  "10": 10, "9": 9, "8": 8, "7": 7, "6": 6, "5": 5, "4": 4, "3": 3, "2": 2,
};

export const ELIMINATION_POINTS = 100;

export function handPoints(cards: Card[]) {
  return cards.reduce((total, card) => total + CARD_POINTS[card.rank], 0);
}

const CARDS_BY_ID = new Map(createDeck().map((card) => [card.id, card]));

export function cardById(id: string): Card {
  const card = CARDS_BY_ID.get(id);
  if (!card) {
    throw new Error(`Carta desconhecida: ${id}`);
  }
  return card;
}
