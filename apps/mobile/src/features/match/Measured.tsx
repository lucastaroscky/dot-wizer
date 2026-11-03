import { useRef, type ReactNode } from "react";
import { View, type HostInstance, type StyleProp, type ViewStyle } from "react-native";
import type { Rect } from "./areas";

type Props = { onMeasure: (rect: Rect) => void; onView?: (view: HostInstance | null) => void; style?: StyleProp<ViewStyle>; children: ReactNode };

export function Measured({ onMeasure, onView, style, children }: Props) {
  const ref = useRef<HostInstance>(null);

  function measure() {
    ref.current?.measureInWindow((x, y, width, height) => onMeasure({ x, y, width, height }));
  }

  return (
    <View
      ref={(view) => {
        ref.current = view;
        onView?.(view);
      }}
      onLayout={measure}
      style={style}
    >
      {children}
    </View>
  );
}
