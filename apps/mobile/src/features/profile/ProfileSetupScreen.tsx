import { Modal, StyleSheet, Text, View } from "react-native";
import { FULL_NAME_MAX_LENGTH, NICKNAME_MAX_LENGTH } from "@pontinho/api-contract";
import { CPF_INPUT_LENGTH } from "@/shared/format/cpf";
import { Button } from "@/shared/ui/Button";
import { Icon } from "@/shared/ui/Icon";
import { Notice } from "@/shared/ui/Notice";
import { Screen } from "@/shared/ui/Screen";
import { TextField } from "@/shared/ui/TextField";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import profile from "@/messages/profile.json";
import { BIRTH_DATE_INPUT_LENGTH } from "./birthDate";
import { useProfileSetup } from "./useProfileSetup";

export function ProfileSetupScreen() {
  const setup = useProfileSetup();

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        {profile.title}
      </Text>
      {setup.error !== "" && <Notice text={setup.error} tone="danger" />}
      <View style={styles.lock}>
        <Icon name="lock" size={18} color={colors.action} />
        <Text style={styles.lockText}>{profile.lockNotice}</Text>
      </View>
      <TextField label={profile.fullNameLabel} value={setup.fullName} onChangeText={setup.changeFullName} maxLength={FULL_NAME_MAX_LENGTH} autoComplete="name" />
      <TextField
        label={profile.cpfLabel}
        value={setup.cpfText}
        onChangeText={setup.changeCpf}
        placeholder={profile.cpfPlaceholder}
        keyboardType="number-pad"
        maxLength={CPF_INPUT_LENGTH}
        onBlur={setup.leaveCpf}
        error={setup.cpfError}
      />
      <TextField
        label={profile.birthDateLabel}
        value={setup.birthDateText}
        onChangeText={setup.changeBirthDate}
        placeholder={profile.birthDatePlaceholder}
        keyboardType="number-pad"
        maxLength={BIRTH_DATE_INPUT_LENGTH}
        onBlur={setup.leaveBirthDate}
        error={setup.birthDateError}
      />
      <View style={styles.field}>
        <TextField label={profile.nicknameLabel} value={setup.nickname} onChangeText={setup.changeNickname} maxLength={NICKNAME_MAX_LENGTH} onSubmitEditing={setup.review} />
        <Text style={styles.hint}>{profile.nicknameHint}</Text>
      </View>
      <View style={styles.footer}>
        <Button title={profile.save} onPress={setup.review} disabled={!setup.canSave} />
      </View>
      <Modal visible={setup.confirming} transparent animationType="slide" onRequestClose={setup.fix}>
        <View style={styles.backdrop}>
          <View accessibilityViewIsModal style={styles.sheet}>
            <View style={styles.grabber} aria-hidden />
            <Text accessibilityRole="header" style={styles.sheetTitle}>
              {profile.confirmTitle}
            </Text>
            <View style={styles.summary}>
              <SummaryLine label={profile.fullNameLabel} value={setup.fullName.trim()} />
              <SummaryLine label={profile.cpfLabel} value={setup.cpfText} />
              <SummaryLine label={profile.birthDateLabel} value={setup.birthDateText} />
            </View>
            <Text style={styles.warning}>{profile.confirmWarning}</Text>
            <Button title={setup.saving ? profile.saving : profile.save} onPress={setup.submit} loading={setup.saving} />
            <Button title={profile.fix} onPress={setup.fix} variant="secondary" disabled={setup.saving} />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 12, color: colors.text, fontSize: 24, fontFamily: fonts.display },
  lock: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  lockText: { flex: 1, color: colors.textSoft, fontSize: 14, lineHeight: 20, fontFamily: fonts.regular },
  field: { gap: 7 },
  hint: { color: colors.muted, fontSize: 12.5, fontFamily: fonts.medium },
  footer: { marginTop: "auto" },
  backdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0, 0, 0, 0.62)" },
  sheet: { gap: 14, paddingTop: 14, paddingHorizontal: 20, paddingBottom: 34, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderTopWidth: 1, borderColor: colors.line, backgroundColor: colors.surface },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.lineStrong, marginBottom: 8 },
  sheetTitle: { color: colors.text, fontSize: 19, fontFamily: fonts.display },
  summary: { gap: 10 },
  summaryLine: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  summaryLabel: { color: colors.muted, fontSize: 15, fontFamily: fonts.regular },
  summaryValue: { flexShrink: 1, color: colors.text, fontSize: 15, fontFamily: fonts.semibold, textAlign: "right", fontVariant: ["tabular-nums"] },
  warning: { color: colors.warningText, fontSize: 14, fontFamily: fonts.regular },
});
