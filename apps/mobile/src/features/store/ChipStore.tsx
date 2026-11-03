import { Pressable, StyleSheet, Text, View } from "react-native";
import { formatChips, formatReais } from "@/shared/format/numbers";
import { WoodButton } from "@/shared/ui/WoodButton";
import { colors } from "@/shared/theme/colors";
import store from "@/messages/store.json";
import type { Purchase } from "./usePurchase";
import type { Quote } from "./useQuote";

type Props = { quote: Quote; purchase: Purchase };

type StepButtonProps = { label: string; symbol: string; disabled: boolean; onPress: () => void };

function StepButton({ label, symbol, disabled, onPress }: StepButtonProps) {
  return (
    <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.step, disabled && styles.stepDisabled]}>
      <Text style={styles.stepText}>{symbol}</Text>
    </Pressable>
  );
}

export function ChipStore({ quote, purchase }: Props) {
  const price = quote.amountCents === undefined ? "" : formatReais(quote.amountCents);
  const priceText = store.price.replace("{value}", price);

  function changeQuantity(change: () => void) {
    purchase.clear();
    change();
  }

  return (
    <View style={styles.content}>
      <Text style={styles.label}>{store.quantity}</Text>
      <View style={styles.row}>
        <StepButton label={store.decrease} symbol="−" disabled={!quote.canDecrease} onPress={() => changeQuantity(quote.decrease)} />
        <Text style={styles.quantity}>{formatChips(quote.quantity)}</Text>
        <StepButton label={store.increase} symbol="+" disabled={!quote.canIncrease} onPress={() => changeQuantity(quote.increase)} />
      </View>
      <Text style={styles.price}>{priceText}</Text>
      <Text style={styles.notice}>{store.testNotice}</Text>
      {purchase.purchasedQuantity !== undefined && (
        <Text style={styles.purchased}>{store.purchased.replace("{quantity}", formatChips(purchase.purchasedQuantity))}</Text>
      )}
      <WoodButton
        title={purchase.pending ? store.buying : store.buy}
        onPress={() => purchase.buy(quote.quantity)}
        disabled={!quote.upToDate || purchase.pending}
        large
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { alignItems: "center", gap: 12 },
  label: { color: colors.woodText, fontSize: 16, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  step: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundImage: colors.woodGradient,
    borderWidth: 3,
    borderColor: colors.woodDark,
  },
  stepDisabled: { opacity: 0.4 },
  stepText: { color: colors.woodText, fontSize: 26, fontWeight: "700" },
  quantity: { minWidth: 120, textAlign: "center", color: colors.woodText, fontSize: 28, fontWeight: "700" },
  price: { color: colors.woodText, fontSize: 20, fontWeight: "600" },
  notice: { color: colors.red, fontSize: 15, fontWeight: "700" },
  purchased: { color: colors.felt, fontSize: 16, fontWeight: "700" },
});
