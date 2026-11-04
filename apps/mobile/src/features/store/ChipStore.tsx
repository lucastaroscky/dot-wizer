import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { formatChips, formatReais } from "@/shared/format/numbers";
import { Button } from "@/shared/ui/Button";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { Notice } from "@/shared/ui/Notice";
import { colors } from "@/shared/theme/colors";
import store from "@/messages/store.json";
import type { Purchase } from "./usePurchase";
import type { Quote } from "./useQuote";

type Props = { quote: Quote; purchase: Purchase };

type StepButtonProps = { label: string; icon: IconName; disabled: boolean; onPress: () => void };

function StepButton({ label, icon, disabled, onPress }: StepButtonProps) {
  return (
    <Pressable accessibilityLabel={label} accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.step, disabled && styles.stepDisabled]}>
      <Icon name={icon} size={22} color={colors.text} />
    </Pressable>
  );
}

export function ChipStore({ quote, purchase }: Props) {
  const price = quote.amountCents === undefined ? "" : formatReais(quote.amountCents);

  function changeQuantity(change: () => void) {
    purchase.clear();
    change();
  }

  return (
    <>
      {purchase.purchasedQuantity !== undefined && (
        <Notice text={store.purchased.replace("{quantity}", formatChips(purchase.purchasedQuantity))} tone="success" />
      )}
      <View style={styles.card}>
        <Text style={styles.label}>{store.quantity}</Text>
        <View style={styles.row}>
          <StepButton label={store.decrease} icon="minus" disabled={!quote.canDecrease} onPress={() => changeQuantity(quote.decrease)} />
          <Text style={styles.quantity}>{formatChips(quote.quantity)}</Text>
          <StepButton label={store.increase} icon="plus" disabled={!quote.canIncrease} onPress={() => changeQuantity(quote.increase)} />
        </View>
        <View style={styles.row}>
          <Text style={styles.price}>{store.price.replace("{value}", price)}</Text>
          {!quote.upToDate && quote.error === "" && <ActivityIndicator size="small" color={colors.muted} />}
        </View>
      </View>
      <View style={styles.notice}>
        <Icon name="info" size={16} color={colors.textSoft} />
        <Text style={styles.noticeText}>{store.testNotice}</Text>
      </View>
      <View style={styles.footer}>
        <Button
          title={purchase.pending ? store.buying : store.buy}
          onPress={() => purchase.buy(quote.quantity)}
          disabled={!quote.upToDate}
          loading={purchase.pending}
        />
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { paddingVertical: 22, paddingHorizontal: 20, borderRadius: 24, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, alignItems: "center", gap: 18 },
  label: { color: colors.muted, fontSize: 14, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 18 },
  step: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.option, alignItems: "center", justifyContent: "center" },
  stepDisabled: { opacity: 0.4 },
  quantity: { minWidth: 150, textAlign: "center", color: colors.text, fontSize: 36, fontWeight: "600", fontVariant: ["tabular-nums"] },
  price: { color: colors.text, fontSize: 18, fontWeight: "600" },
  notice: { alignSelf: "center", height: 32, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.lineStrong, flexDirection: "row", alignItems: "center", gap: 8 },
  noticeText: { color: colors.textSoft, fontSize: 13, fontWeight: "600" },
  footer: { marginTop: "auto" },
});
