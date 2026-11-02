import { schema, t, type SchemaType } from "@colyseus/schema";
import { z } from "zod";
import { CHIP_TABLES, cardById, createDeck, type GameError, type Meld, type MeldKind } from "@pontinho/rules";

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
  photoUrl: t.string().default(""),
  cardCount: t.uint8().default(0),
  points: t.uint16().default(0),
  roundPoints: t.uint16().default(0),
  eliminated: t.boolean().default(false),
  awaitingReturn: t.boolean().default(false),
  bot: t.boolean().default(false),
  bluffed: t.boolean().default(false),
  connection: t.string().default("connected"),
  chipsResult: t.int32().default(0),
  chipsDeficit: t.uint32().default(0),
  chipsBalance: t.uint32().default(0),
  roundChips: t.int32().default(0),
  hand: t.array(CardState).view(),
});
export type Player = SchemaType<typeof Player>;

export const PontinhoState = schema({
  players: t.map(Player),
  order: t.array("string"),
  phase: t.string().default("waiting"),
  seats: t.uint8().default(3),
  table: t.uint8().default(0),
  matchId: t.string().default(""),
  pointValue: t.uint32().default(0),
  currentTurn: t.string().default(""),
  hasDrawn: t.boolean().default(false),
  discardIsFree: t.boolean().default(false),
  turnNumber: t.uint32().default(0),
  turnDuration: t.uint32().default(0),
  returnNumber: t.uint32().default(0),
  returnDuration: t.uint32().default(0),
  lastDiscarder: t.string().default(""),
  announcement: t.string().default(""),
  announcementPlayer: t.string().default(""),
  winner: t.string().default(""),
  wentOut: t.string().default(""),
  discardTop: t.ref(CardState).optional(),
  stockCount: t.uint8().default(0),
  melds: t.array(MeldState),
});
export type PontinhoState = SchemaType<typeof PontinhoState>;

export const ROOM_NAME = "pontinho";
export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 4;
export const PRACTICE_TABLE = 0;
export const MAX_CARDS_PER_ACTION = 14;

const cardIdSchema = z.enum(createDeck().map((card) => card.id) as [string, ...string[]]);
const cardIdsSchema = z.array(cardIdSchema).max(MAX_CARDS_PER_ACTION);
const meldIndexSchema = z.number().int().min(0);

const tableSchema = z.number().int().refine((table) => CHIP_TABLES.some(({ id }) => id === table));

const seatsSchema = z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS);

export const createOptionsSchema = z.discriminatedUnion("bots", [
  z.object({ bots: z.literal(true), seats: seatsSchema, table: tableSchema.optional() }),
  z.object({ bots: z.literal(false), seats: seatsSchema, table: tableSchema }),
]);

export const discardMessageSchema = cardIdSchema;
export const chooseReturnMessageSchema = z.object({ back: z.boolean() });
export const meldMessageSchema = z.object({ cardIds: cardIdsSchema });
export const takeDiscardMessageSchema = z.object({ cardIds: cardIdsSchema, meldIndex: meldIndexSchema.optional() });
export const layOffMessageSchema = z.object({
  cardIds: cardIdsSchema,
  meldIndex: meldIndexSchema,
  jokerTo: z.object({ meldIndex: meldIndexSchema.optional(), cardIds: cardIdsSchema }).optional(),
});

export type CreateOptions = z.infer<typeof createOptionsSchema>;

export type ClientMessages = {
  draw: undefined;
  takeDiscard: z.infer<typeof takeDiscardMessageSchema>;
  meld: z.infer<typeof meldMessageSchema>;
  layOff: z.infer<typeof layOffMessageSchema>;
  discard: z.infer<typeof discardMessageSchema>;
  goOut: undefined;
  chooseReturn: z.infer<typeof chooseReturnMessageSchema>;
};

export type MoveEvent = { kind: "draw" | "toTable" | "discard"; playerId: string; cardIds: string[] };

export type InvalidPlay = Exclude<GameError, "notAllowed">;

export type ServerMessages = {
  invalid: InvalidPlay;
  move: MoveEvent;
};

export const ANNOUNCEMENTS = ["wentOut", "bluffed", "won", "outOfCards", "returned", "eliminated"] as const;
export type Announcement = (typeof ANNOUNCEMENTS)[number];

export const CONNECTIONS = ["connected", "reconnecting", "left"] as const;
export type Connection = (typeof CONNECTIONS)[number];

export const JOIN_REFUSALS = {
  alreadyInRoom: { code: 4400, message: "alreadyInRoom" },
  invalidToken: { code: 401, message: "invalidToken" },
  profileIncomplete: { code: 403, message: "profileIncomplete" },
  insufficientBalance: { code: 403, message: "insufficientBalance" },
  apiUnavailable: { code: 503, message: "apiUnavailable" },
  invalidOptions: { code: 400, message: "invalidOptions" },
} as const;
export type JoinRefusal = keyof typeof JOIN_REFUSALS;

export function toAnnouncement(value: string): Announcement | undefined {
  return ANNOUNCEMENTS.find((announcement) => announcement === value);
}

export function toMeld(meld: { kind: string; cards: ArrayLike<{ id: string }> }): Meld {
  return { kind: meld.kind as MeldKind, cards: Array.from(meld.cards, (card) => cardById(card.id)) };
}
