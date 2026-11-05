import { useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { profileQueryOptions } from "@/shared/api/profile";
import { formatCpf, maskCpf } from "@/shared/format/cpf";
import { goBackOrHome } from "@/shared/navigation/goBackOrHome";
import { Button } from "@/shared/ui/Button";
import { Icon, type IconName } from "@/shared/ui/Icon";
import { ErrorLine, Notice } from "@/shared/ui/Notice";
import { Screen } from "@/shared/ui/Screen";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import home from "@/messages/home.json";
import profileMessages from "@/messages/profile.json";
import store from "@/messages/store.json";
import { usePixKey } from "./usePixKey";

type Props = { balanceCard: ReactNode; walletError: string; onRetryWallet: () => void };

export function PaymentsScreen({ balanceCard, walletError, onRetryWallet }: Props) {
  const { data: profile } = useQuery(profileQueryOptions());
  const [showingAccount, setShowingAccount] = useState(false);
  const pixKey = usePixKey({ onRegistered: () => setShowingAccount(false) });
  const cpf = profile?.cpf ?? "";
  const registered = profile?.pixKeyRegistered === true;

  if (showingAccount) {
    return (
      <Screen>
        <ScreenHeader title={store.receivingAccount} backLabel={store.back} onBack={() => setShowingAccount(false)}>
          {balanceCard}
        </ScreenHeader>
        <View style={styles.keyType}>
          <Text style={styles.label}>{store.pixKeyType}</Text>
          <View style={styles.chip}>
            <Icon name="lock" size={16} color={colors.onSelected} />
            <Text style={styles.chipText}>{profileMessages.cpfLabel}</Text>
          </View>
        </View>
        <View style={styles.keyField}>
          <Text style={styles.keyLabel}>{store.pixKey}</Text>
          <TextInput value={formatCpf(cpf)} editable={false} accessibilityLabel={store.pixKey} style={styles.keyInput} />
        </View>
        <Notice text={store.withdrawNotice} tone="neutral" />
        <ErrorLine text={pixKey.error} />
        <View style={styles.footer}>
          <Button title={pixKey.pending ? profileMessages.saving : store.registerPixKey} onPress={pixKey.register} loading={pixKey.pending} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenHeader title={home.payments} backLabel={store.back} onBack={goBackOrHome}>
        {balanceCard}
      </ScreenHeader>
      {walletError !== "" && <Notice text={walletError} tone="danger" onRetry={onRetryWallet} />}
      <PathCard icon="chip" highlighted title={store.buyChips} hint={store.pixOnly} onPress={() => router.push("/store")} />
      <PathCard
        icon="bank"
        title={store.receivingAccount}
        hint={registered ? store.receivingAccountRegistered.replace("{cpf}", maskCpf(cpf)) : store.receivingAccountMissing}
        warning={!registered}
        done={registered}
        onPress={() => setShowingAccount(true)}
      />
    </Screen>
  );
}

type PathCardProps = { icon: IconName; title: string; hint: string; highlighted?: boolean; warning?: boolean; done?: boolean; onPress: () => void };

function PathCard({ icon, title, hint, highlighted = false, warning = false, done = false, onPress }: PathCardProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={done}
      accessibilityRole="button"
      accessibilityState={{ disabled: done }}
      style={({ pressed }) => [styles.card, highlighted && styles.cardHighlighted, pressed && styles.pressed]}
    >
      <View style={[styles.cardIcon, highlighted && styles.cardIconHighlighted]}>
        <Icon name={icon} size={24} color={highlighted ? colors.onAction : colors.text} />
      </View>
      <View style={styles.cardText}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={[styles.cardHint, warning && styles.cardHintWarning]}>{hint}</Text>
      </View>
      {done ? <Icon name="check" size={20} color={colors.action} /> : <Icon name="chevron" size={18} color={colors.faint} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: { opacity: 0.85 },
  card: { minHeight: 92, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 14 },
  cardHighlighted: { borderColor: colors.lineStrong },
  cardIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.option, alignItems: "center", justifyContent: "center" },
  cardIconHighlighted: { backgroundColor: colors.action },
  cardText: { flex: 1, gap: 3 },
  cardTitle: { color: colors.text, fontSize: 17, fontFamily: fonts.display },
  cardHint: { color: colors.muted, fontSize: 13, fontFamily: fonts.regular },
  cardHintWarning: { color: colors.warningText },
  keyType: { gap: 8 },
  label: { color: colors.muted, fontSize: 13, fontFamily: fonts.semibold },
  chip: { alignSelf: "flex-start", height: 40, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1.5, borderColor: colors.onSelected, backgroundColor: colors.selected, flexDirection: "row", alignItems: "center", gap: 8 },
  chipText: { color: colors.onSelected, fontSize: 15, fontFamily: fonts.bold },
  keyField: { gap: 7 },
  keyLabel: { color: colors.textSoft, fontSize: 14, fontFamily: fonts.semibold },
  keyInput: { height: 52, paddingHorizontal: 16, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.plate, color: colors.optionText, fontSize: 16, fontFamily: fonts.medium, fontVariant: ["tabular-nums"], outlineStyle: "solid", outlineWidth: 0 },
  footer: { marginTop: "auto" },
});
