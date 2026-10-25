import { schema, t, type SchemaType } from "@colyseus/schema";

export const CardState = schema({
  id: t.string(),
  rank: t.string(),
  suit: t.string().default(""),
});
export type CardState = SchemaType<typeof CardState>;

export const MeldState = schema({
  kind: t.string(),
  cards: t.array(CardState),
});
export type MeldState = SchemaType<typeof MeldState>;

export const Player = schema({
  name: t.string().default(""),
  cardCount: t.uint8().default(0),
  points: t.uint16().default(0),
  roundPoints: t.uint16().default(0),
  eliminated: t.boolean().default(false),
  bot: t.boolean().default(false),
  bluffed: t.boolean().default(false),
  hand: t.array(CardState).view(),
});
export type Player = SchemaType<typeof Player>;

export const PontinhoState = schema({
  players: t.map(Player),
  order: t.array("string"),
  phase: t.string().default("waiting"),
  seats: t.uint8().default(3),
  currentTurn: t.string().default(""),
  hasDrawn: t.boolean().default(false),
  discardIsFree: t.boolean().default(false),
  turnDeadline: t.number().default(0),
  lastDiscarder: t.string().default(""),
  announcement: t.string().default(""),
  winner: t.string().default(""),
  wentOut: t.string().default(""),
  discardTop: t.ref(CardState).optional(),
  stockCount: t.uint8().default(0),
  melds: t.array(MeldState),
});
export type PontinhoState = SchemaType<typeof PontinhoState>;
