import { SymbolView, type SFSymbol, type AndroidSymbol } from "expo-symbols";

const ICONS = {
  alert: { ios: "exclamationmark.circle", material: "error" },
  info: { ios: "info.circle", material: "info" },
  offline: { ios: "wifi.slash", material: "wifi_off" },
  gift: { ios: "gift", material: "redeem" },
  chip: { ios: "circle.circle", material: "toll" },
  store: { ios: "bag", material: "storefront" },
  signOut: { ios: "rectangle.portrait.and.arrow.right", material: "logout" },
  forward: { ios: "arrow.right", material: "arrow_forward" },
  chevron: { ios: "chevron.right", material: "chevron_right" },
  back: { ios: "chevron.left", material: "arrow_back" },
  plus: { ios: "plus", material: "add" },
  minus: { ios: "minus", material: "remove" },
  check: { ios: "checkmark", material: "check" },
  lock: { ios: "lock", material: "lock" },
  trophy: { ios: "trophy", material: "emoji_events" },
  eye: { ios: "eye", material: "visibility" },
  bot: { ios: "gamecontroller", material: "smart_toy" },
  payments: { ios: "creditcard", material: "credit_card" },
  book: { ios: "book", material: "menu_book" },
  person: { ios: "person", material: "person" },
  edit: { ios: "pencil", material: "edit" },
  photo: { ios: "photo", material: "photo_library" },
} satisfies Record<string, { ios: SFSymbol; material: AndroidSymbol }>;

export type IconName = keyof typeof ICONS;

type Props = { name: IconName; size: number; color: string };

export function Icon({ name, size, color }: Props) {
  const { ios, material } = ICONS[name];
  return <SymbolView name={{ ios, android: material, web: material }} size={size} tintColor={color} />;
}
