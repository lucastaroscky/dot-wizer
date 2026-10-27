export type Rect = { x: number; y: number; width: number; height: number };

export type TableAreas = {
  stock?: Rect;
  discard?: Rect;
  table?: Rect;
  hand?: Rect;
  plates: Record<string, Rect>;
  melds: Rect[];
};

export function contains(rect: Rect | undefined, x: number, y: number) {
  return rect !== undefined && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}
