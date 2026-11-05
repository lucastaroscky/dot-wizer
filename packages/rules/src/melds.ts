import { isJoker, type Card, type NaturalCard, type Rank, type Wild } from "./cards.ts";

export type MeldKind = "set" | "run";
export type Meld = { kind: MeldKind; cards: Card[] };

const MIN_MELD_SIZE = 3;
const MAX_JOKERS_IN_RUN = 2;
const ACE_HIGH = 14;
const RANK_VALUES: Record<Rank, number> = {
  A: 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8, "9": 9, "10": 10, J: 11, Q: 12, K: 13,
};

function isNatural(card: Card, wild?: Wild): card is NaturalCard {
  return !isJoker(card, wild);
}

export type MeldOptions = { goingOut?: boolean; wild?: Wild };

export function createMeld(cards: Card[], { goingOut = false, wild }: MeldOptions = {}): Meld | undefined {
  if (cards.length < MIN_MELD_SIZE) {
    return undefined;
  }
  return createSet(cards, wild) ?? arrangeRun(cards, goingOut, wild);
}

export function addToMeld(meld: Meld, cards: Card[], { goingOut = false, wild }: MeldOptions = {}): Meld | undefined {
  if (meld.kind === "set") {
    return addToSet(meld, cards, wild);
  }
  return arrangeRun([...meld.cards, ...cards], goingOut, wild);
}

export function replaceJoker(meld: Meld, card: Card, { wild }: MeldOptions = {}): { meld: Meld; joker: Card } | undefined {
  const jokerIndex = meld.cards.findIndex((current) => isJoker(current, wild));
  if (meld.kind !== "run" || jokerIndex === -1 || isJoker(card, wild)) {
    return undefined;
  }
  const rest = meld.cards.filter((_, index) => index !== jokerIndex);
  const replaced = arrangeRun([...rest, card], false, wild);
  if (!replaced) {
    return undefined;
  }
  return { meld: replaced, joker: meld.cards[jokerIndex] };
}

function createSet(cards: Card[], wild: Wild | undefined): Meld | undefined {
  const naturals = cards.filter((card) => isNatural(card, wild));
  const suits = new Set(naturals.map((card) => card.suit));
  const sameRank = naturals.every((card) => card.rank === naturals[0].rank);
  if (naturals.length !== cards.length || !sameRank || suits.size !== cards.length) {
    return undefined;
  }
  return { kind: "set", cards };
}

function addToSet(meld: Meld, cards: Card[], wild: Wild | undefined): Meld | undefined {
  const setCards = meld.cards.filter((card) => isNatural(card));
  const suits = new Set(setCards.map((card) => card.suit));
  const fits = cards.every((card) => isNatural(card, wild) && card.rank === setCards[0].rank && suits.has(card.suit));
  if (!fits) {
    return undefined;
  }
  return { kind: "set", cards: [...meld.cards, ...cards] };
}

function arrangeRun(cards: Card[], goingOut: boolean, wild: Wild | undefined): Meld | undefined {
  const jokers = cards.filter((card) => isJoker(card, wild));
  const naturals = cards.filter((card) => isNatural(card, wild));
  const suits = new Set(naturals.map((card) => card.suit));
  if (jokers.length > MAX_JOKERS_IN_RUN || suits.size !== 1) {
    return undefined;
  }
  const arranged = arrangeWithAce(naturals, jokers, false, goingOut) ?? arrangeWithAce(naturals, jokers, true, goingOut);
  if (!arranged || arranged.length < MIN_MELD_SIZE) {
    return undefined;
  }
  return { kind: "run", cards: arranged };
}

function arrangeWithAce(naturals: NaturalCard[], jokers: Card[], aceHigh: boolean, goingOut: boolean): Card[] | undefined {
  const valued = naturals
    .map((card) => ({ card, value: card.rank === "A" && aceHigh ? ACE_HIGH : RANK_VALUES[card.rank] }))
    .sort((a, b) => a.value - b.value);
  const maxGap = goingOut ? MAX_JOKERS_IN_RUN : 1;

  const arranged: Card[] = [valued[0].card];
  let jokersUsed = 0;

  for (let index = 1; index < valued.length; index++) {
    const gap = valued[index].value - valued[index - 1].value - 1;
    if (gap < 0 || gap > maxGap || gap > jokers.length - jokersUsed) {
      return undefined;
    }
    for (let filled = 0; filled < gap; filled++) {
      arranged.push(jokers[jokersUsed]);
      jokersUsed++;
    }
    arranged.push(valued[index].card);
  }

  const spare = jokers.slice(jokersUsed);
  if (spare.length === 0) {
    return arranged;
  }
  if (!goingOut) {
    return undefined;
  }
  return placeAtEnds(arranged, spare, valued[0].value, valued[valued.length - 1].value);
}

function placeAtEnds(arranged: Card[], spare: Card[], lowest: number, highest: number): Card[] | undefined {
  const above = Math.min(spare.length, ACE_HIGH - highest);
  const below = spare.length - above;
  if (lowest - below < 1) {
    return undefined;
  }
  return [...spare.slice(above), ...arranged, ...spare.slice(0, above)];
}

export type GoOut = { table: Meld[]; discard?: Card };

export function findMeldInHand(hand: Card[], { wild }: MeldOptions = {}): Card[] | undefined {
  for (let first = 0; first < hand.length; first++) {
    for (let second = first + 1; second < hand.length; second++) {
      for (let third = second + 1; third < hand.length; third++) {
        const cards = [hand[first], hand[second], hand[third]];
        if (createMeld(cards, { goingOut: hand.length <= 4, wild })) {
          return cards;
        }
      }
    }
  }
  return undefined;
}

export function fitsTable(card: Card, table: Meld[], { wild }: MeldOptions = {}) {
  return table.some((meld) => addToMeld(meld, [card], { wild }) !== undefined || replaceJoker(meld, card, { wild }) !== undefined);
}

export function canDiscard(card: Card, table: Meld[], { wild }: MeldOptions = {}) {
  return !isJoker(card, wild) && !fitsTable(card, table, { wild });
}

export function findGoOut(hand: Card[], table: Meld[], { mustUse, wild }: { mustUse?: Card; wild?: Wild } = {}): GoOut | undefined {
  const withoutDiscard = meldAll(hand, table, wild);
  if (withoutDiscard) {
    return { table: withoutDiscard };
  }
  for (const discard of hand) {
    if (discard === mustUse || isJoker(discard, wild)) {
      continue;
    }
    const finalTable = meldAll(hand.filter((card) => card !== discard), table, wild);
    if (finalTable) {
      return { table: finalTable, discard };
    }
  }
  return undefined;
}

function meldAll(cards: Card[], table: Meld[], wild: Wild | undefined): Meld[] | undefined {
  if (cards.length === 0) {
    return table;
  }
  const [first, ...others] = cards;

  for (let index = 0; index < table.length; index++) {
    const extended = addToMeld(table[index], [first], { goingOut: true, wild });
    const result = extended && meldAll(others, table.map((meld, at) => (at === index ? extended : meld)), wild);
    if (result) {
      return result;
    }
  }

  for (const group of groupsOf(others)) {
    const meld = createMeld([first, ...group], { goingOut: true, wild });
    const result = meld && meldAll(others.filter((card) => !group.includes(card)), [...table, meld], wild);
    if (result) {
      return result;
    }
  }
  return undefined;
}

function groupsOf(cards: Card[]): Card[][] {
  const groups: Card[][] = [];
  for (let mask = 1; mask < 1 << cards.length; mask++) {
    const group = cards.filter((_, index) => mask & (1 << index));
    if (group.length >= MIN_MELD_SIZE - 1) {
      groups.push(group);
    }
  }
  return groups;
}
