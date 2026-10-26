import { schema, t, type SchemaType } from "@colyseus/schema";
import { z } from "zod";
import { createDeck } from "@pontinho/rules";

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

export const ROOM_NAME = "pontinho";
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const MAX_NAME_LENGTH = 20;
export const MAX_CARDS_PER_ACTION = 14;

const cardIdSchema = z.enum(createDeck().map((card) => card.id) as [string, ...string[]]);
const cardIdsSchema = z.array(cardIdSchema).max(MAX_CARDS_PER_ACTION);
const meldIndexSchema = z.number().int().min(0);

export const createOptionsSchema = z.object({ seats: z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS), bots: z.boolean() });
export const joinOptionsSchema = z.object({ name: z.string().trim().min(1).max(MAX_NAME_LENGTH) });

export const discardMessageSchema = cardIdSchema;
export const meldMessageSchema = z.object({ cardIds: cardIdsSchema });
export const takeDiscardMessageSchema = z.object({ cardIds: cardIdsSchema, meldIndex: meldIndexSchema.optional() });
export const layOffMessageSchema = z.object({
  cardIds: cardIdsSchema,
  meldIndex: meldIndexSchema,
  jokerTo: z.object({ meldIndex: meldIndexSchema.optional(), cardIds: cardIdsSchema }).optional(),
});

export type CreateOptions = z.infer<typeof createOptionsSchema>;
export type JoinOptions = z.infer<typeof joinOptionsSchema>;

export type ClientMessages = {
  draw: undefined;
  takeDiscard: z.infer<typeof takeDiscardMessageSchema>;
  meld: z.infer<typeof meldMessageSchema>;
  layOff: z.infer<typeof layOffMessageSchema>;
  discard: z.infer<typeof discardMessageSchema>;
  goOut: undefined;
};

export type MoveEvent = { kind: "draw" | "toTable" | "discard"; playerId: string; cardIds: string[] };

export type ServerMessages = {
  invalid: string;
  move: MoveEvent;
};
