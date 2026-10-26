import type { ArraySchema } from "@colyseus/schema";
import { CardState, MeldState, type PontinhoState } from "@pontinho/protocol";
import type { Card, Game, Meld } from "@pontinho/rules";

function toCardState(card: Card) {
  const cardState = new CardState();
  cardState.id = card.id;
  cardState.rank = card.rank;
  if (card.rank !== "JOKER") {
    cardState.suit = card.suit;
  }
  return cardState;
}

function toMeldState(meld: Meld) {
  const meldState = new MeldState();
  meldState.kind = meld.kind;
  meldState.cards.push(...meld.cards.map(toCardState));
  return meldState;
}

function sameCards(cardStates: ArraySchema<CardState>, cards: Card[]) {
  return cardStates.length === cards.length && cards.every((card, index) => cardStates[index].id === card.id);
}

function mirrorCards(cardStates: ArraySchema<CardState>, cards: Card[]) {
  if (sameCards(cardStates, cards)) {
    return;
  }
  cardStates.clear();
  cardStates.push(...cards.map(toCardState));
}

function mirrorMelds(meldStates: ArraySchema<MeldState>, melds: Meld[]) {
  const unchanged = meldStates.length === melds.length && melds.every((meld, index) => sameCards(meldStates[index].cards, meld.cards));
  if (unchanged) {
    return;
  }
  meldStates.clear();
  meldStates.push(...melds.map(toMeldState));
}

export function mirrorGame(state: PontinhoState, game: Game) {
  for (const gamePlayer of game.players) {
    const player = state.players.get(gamePlayer.id);
    if (!player) {
      continue;
    }
    mirrorCards(player.hand, gamePlayer.hand);
    player.cardCount = gamePlayer.hand.length;
    player.points = gamePlayer.points;
    player.roundPoints = gamePlayer.roundPoints;
    player.eliminated = gamePlayer.eliminated;
    player.bluffed = gamePlayer.bluffed;
  }

  state.phase = game.phase;
  state.currentTurn = game.currentTurn;
  state.hasDrawn = game.hasDrawn;
  state.discardIsFree = game.discardIsFree;
  state.lastDiscarder = game.lastDiscarder;
  state.wentOut = game.wentOut;
  state.winner = game.winner;
  state.stockCount = game.stock.length;
  mirrorMelds(state.melds, game.melds);

  const top = game.discard.at(-1);
  if (state.discardTop?.id !== top?.id) {
    state.discardTop = top ? toCardState(top) : undefined;
  }
}
