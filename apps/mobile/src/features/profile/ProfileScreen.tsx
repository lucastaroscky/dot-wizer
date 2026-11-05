import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { profileQueryOptions } from "@/shared/api/profile";
import { maskCpf } from "@/shared/format/cpf";
import { formatChips } from "@/shared/format/numbers";
import { goBackOrHome } from "@/shared/navigation/goBackOrHome";
import { Avatar } from "@/shared/ui/Avatar";
import { Icon } from "@/shared/ui/Icon";
import { Notice } from "@/shared/ui/Notice";
import { Screen } from "@/shared/ui/Screen";
import { ScreenHeader } from "@/shared/ui/ScreenHeader";
import { Sheet } from "@/shared/ui/Sheet";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import auth from "@/messages/auth.json";
import home from "@/messages/home.json";
import lobby from "@/messages/lobby.json";
import profileMessages from "@/messages/profile.json";
import wallet from "@/messages/wallet.json";
import { toBirthDateInput } from "./birthDate";
import { DeleteSheet, NicknameSheet, PhoneSheet, PhotoSheet } from "./ProfileSheets";
import { useDeleteAccount } from "./useDeleteAccount";
import { useProfileUpdate } from "./useProfileUpdate";

const UNKNOWN = "—";

type SheetName = "photo" | "nickname" | "phone" | "delete";

type SignOut = { signOut: () => void; pending: boolean; error: string };

type Props = { balance?: number; signOut: SignOut };

export function ProfileScreen({ balance, signOut }: Props) {
  const query = useQuery(profileQueryOptions());
  const profile = query.data;
  const [sheet, setSheet] = useState<SheetName>();
  const closeSheet = () => setSheet(undefined);
  const update = useProfileUpdate({ onSaved: closeSheet });
  const deletion = useDeleteAccount();

  function close() {
    update.reset();
    closeSheet();
  }

  function choosePhoto() {
    close();
    update.pickPhoto();
  }

  function open(name: SheetName) {
    update.reset();
    deletion.reset();
    setSheet(name);
  }

  return (
    <Screen>
      <ScreenHeader title={home.profile} backLabel={lobby.back} onBack={goBackOrHome} />
      {query.isError && <Notice text={profileMessages.loadFailed} tone="danger" onRetry={() => query.refetch()} />}
      {signOut.error !== "" && <Notice text={signOut.error} tone="danger" />}
      {sheet === undefined && update.error !== "" && <Notice text={update.error} tone="danger" />}
      {profile && (
        <>
          <View style={styles.game}>
            <View style={styles.photo}>
              <Avatar name={profile.nickname ?? ""} size={76} photoUrl={profile.photoUrl} />
              <Pressable onPress={() => open("photo")} disabled={update.saving} accessibilityRole="button" style={styles.photoButton}>
                <Text style={styles.photoButtonText}>{update.saving ? profileMessages.saving : profileMessages.changePhoto}</Text>
              </Pressable>
            </View>
            <View style={styles.gameInfo}>
              <View style={styles.nicknameRow}>
                <View style={styles.flex}>
                  <Text style={styles.label}>{profileMessages.nicknameLabel}</Text>
                  <Text style={styles.nickname} numberOfLines={1}>
                    {profile.nickname}
                  </Text>
                </View>
                <Pressable onPress={() => open("nickname")} accessibilityRole="button" accessibilityLabel={profileMessages.editNickname} style={styles.iconButton}>
                  <Icon name="edit" size={18} color={colors.text} />
                </Pressable>
              </View>
              <View>
                <Text style={styles.label}>{wallet.balance}</Text>
                <View style={styles.chips}>
                  <Icon name="chip" size={16} color={colors.action} />
                  <Text style={styles.chipsValue}>{balance === undefined ? UNKNOWN : formatChips(balance)}</Text>
                </View>
              </View>
            </View>
          </View>
          <View style={[styles.box, styles.lockedBox]}>
            <View style={styles.boxTitleRow}>
              <Icon name="lock" size={14} color={colors.muted} />
              <Text style={styles.boxTitle}>{profileMessages.personalData}</Text>
            </View>
            <DataLine label={profileMessages.fullNameLabel} value={profile.fullName ?? UNKNOWN} />
            <DataLine label={profileMessages.cpfLabel} value={profile.cpf ? maskCpf(profile.cpf) : UNKNOWN} />
            <DataLine label={profileMessages.birthDateLabel} value={profile.birthDate ? toBirthDateInput(profile.birthDate) : UNKNOWN} last />
          </View>
          <View style={styles.box}>
            <Text style={[styles.boxTitle, styles.boxTitleRow]}>{profileMessages.contact}</Text>
            <ContactLine label={auth.emailLabel} value={profile.email} />
            <ContactLine label={profileMessages.phoneLabel} value={profile.phone ?? UNKNOWN} onChange={() => open("phone")} last />
          </View>
        </>
      )}
      <View style={styles.footer}>
        <Pressable onPress={signOut.signOut} disabled={signOut.pending} accessibilityRole="button" style={({ pressed }) => [styles.footerButton, styles.signOut, pressed && styles.pressed]}>
          <Icon name="signOut" size={18} color={colors.text} />
          <Text style={styles.signOutText}>{home.signOut}</Text>
        </Pressable>
        <Pressable onPress={() => open("delete")} accessibilityRole="button" style={({ pressed }) => [styles.footerButton, styles.delete, pressed && styles.pressed]}>
          <Text style={styles.deleteText}>{profileMessages.deleteAccount}</Text>
        </Pressable>
      </View>
      <Sheet visible={sheet !== undefined} onClose={close}>
        {sheet === "photo" && <PhotoSheet onPick={choosePhoto} onClose={close} />}
        {sheet === "nickname" && <NicknameSheet current={profile?.nickname ?? ""} saving={update.saving} error={update.error} onSave={(nickname) => update.save({ nickname })} />}
        {sheet === "phone" && <PhoneSheet current={profile?.phone ?? ""} saving={update.saving} error={update.error} onSave={(phone) => update.save({ phone })} />}
        {sheet === "delete" && <DeleteSheet deleting={deletion.pending} error={deletion.error} onDelete={deletion.remove} onCancel={close} />}
      </Sheet>
    </Screen>
  );
}

function DataLine({ label, value, last = false }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.dataLine, !last && styles.divided]}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text style={styles.dataValue}>{value}</Text>
    </View>
  );
}

type ContactLineProps = { label: string; value: string; onChange?: () => void; last?: boolean };

function ContactLine({ label, value, onChange, last = false }: ContactLineProps) {
  return (
    <View style={[styles.contactLine, !last && styles.divided]}>
      <View style={styles.flex}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.contactValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
      {onChange && (
        <Pressable onPress={onChange} accessibilityRole="button" accessibilityLabel={`${profileMessages.change} ${label}`} style={styles.changeButton}>
          <Text style={styles.changeText}>{profileMessages.change}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  pressed: { opacity: 0.85 },
  game: { padding: 16, borderRadius: 22, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.surface, flexDirection: "row", alignItems: "center", gap: 16 },
  photo: { alignItems: "center", gap: 8 },
  photoButton: { height: 32, paddingHorizontal: 10, justifyContent: "center" },
  photoButtonText: { color: colors.action, fontSize: 13, fontFamily: fonts.semibold },
  gameInfo: { flex: 1, minWidth: 0, gap: 10 },
  nicknameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { color: colors.muted, fontSize: 12, fontFamily: fonts.regular },
  nickname: { color: colors.text, fontSize: 20, fontFamily: fonts.display },
  iconButton: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.option, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", alignItems: "center", gap: 6 },
  chipsValue: { color: colors.text, fontSize: 18, fontFamily: fonts.display, fontVariant: ["tabular-nums"] },
  box: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  lockedBox: { backgroundColor: colors.plate },
  boxTitleRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8, marginBottom: 4 },
  boxTitle: { color: colors.muted, fontSize: 12.5, fontFamily: fonts.semibold },
  dataLine: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  divided: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  dataLabel: { color: colors.muted, fontSize: 14, fontFamily: fonts.regular },
  dataValue: { flexShrink: 1, color: colors.optionText, fontSize: 14, fontFamily: fonts.semibold, textAlign: "right", fontVariant: ["tabular-nums"] },
  contactLine: { minHeight: 54, paddingVertical: 6, flexDirection: "row", alignItems: "center", gap: 12 },
  contactValue: { color: colors.text, fontSize: 15, fontFamily: fonts.semibold, fontVariant: ["tabular-nums"] },
  changeButton: { height: 36, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.option, justifyContent: "center" },
  changeText: { color: colors.text, fontSize: 13, fontFamily: fonts.semibold },
  footer: { marginTop: "auto", flexDirection: "row", gap: 10 },
  footerButton: { flex: 1, height: 50, borderRadius: 14, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  signOut: { borderColor: colors.line, backgroundColor: colors.surface },
  signOutText: { color: colors.text, fontSize: 15, fontFamily: fonts.semibold },
  delete: { borderColor: colors.dangerLine },
  deleteText: { color: colors.errorText, fontSize: 15, fontFamily: fonts.semibold },
});
