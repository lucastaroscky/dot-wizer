import type { HostInstance } from "react-native";

export type Rect = { x: number; y: number; width: number; height: number };

export type TableAreas = {
  stock?: Rect;
  discard?: Rect;
  table?: Rect;
  hand?: Rect;
  plates: Record<string, Rect>;
  discardView?: HostInstance | null;
  meldViews: (HostInstance | null)[];
};

export function contains(rect: Rect | undefined, x: number, y: number) {
  return rect !== undefined && x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height;
}

export function measureRect(view: HostInstance | null | undefined) {
  return new Promise<Rect | undefined>((resolve) => {
    if (!view) {
      resolve(undefined);
      return;
    }
    view.measureInWindow((x, y, width, height) => resolve({ x, y, width, height }));
  });
}
