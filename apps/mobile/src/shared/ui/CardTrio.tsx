import { StyleSheet, View } from "react-native";
import { Card, CardBack } from "@/shared/cards/Card";

const ACE = { id: "A-hearts-1", rank: "A", suit: "hearts" };

export function CardTrio({ width }: { width: number }) {
  const side = { position: "absolute", top: width * 0.2 } as const;
  return (
    <View style={{ width: width * 2.4, height: width * 1.75 }} aria-hidden>
      <View style={[side, styles.shadow, { left: width * 0.2, transform: [{ rotate: "-15deg" }] }]}>
        <CardBack width={width} />
      </View>
      <View style={[side, styles.shadow, { right: width * 0.2, transform: [{ rotate: "15deg" }] }]}>
        <CardBack width={width} />
      </View>
      <View style={[styles.shadow, { position: "absolute", left: width * 0.7 }]}>
        <Card card={ACE} width={width} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { boxShadow: "0 10px 24px rgba(0, 0, 0, 0.55)" },
});
