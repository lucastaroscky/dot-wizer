import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { NICKNAME_MAX_LENGTH, phoneSchema } from "@pontinho/api-contract";
import { Button } from "@/shared/ui/Button";
import { ErrorLine } from "@/shared/ui/Notice";
import { TextField } from "@/shared/ui/TextField";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import lobby from "@/messages/lobby.json";
import profile from "@/messages/profile.json";

type SaveProps = { saving: boolean; error: string };

export function PhotoSheet({ onPick, onClose }: { onPick: () => void; onClose: () => void }) {
  return (
    <>
      <Text accessibilityRole="header" style={styles.title}>
        {profile.changePhoto}
      </Text>
      <Button title={profile.choosePhotoFromGallery} onPress={onPick} variant="secondary" />
      <Button title={lobby.back} onPress={onClose} variant="plain" />
    </>
  );
}

export function NicknameSheet({ current, saving, error, onSave }: SaveProps & { current: string; onSave: (nickname: string) => void }) {
  const [nickname, setNickname] = useState(current);
  const canSave = nickname.trim().length > 0 && !saving;

  function save() {
    if (!canSave) {
      return;
    }
    onSave(nickname.trim());
  }

  return (
    <>
      <View style={styles.field}>
        <TextField label={profile.nicknameLabel} value={nickname} onChangeText={setNickname} maxLength={NICKNAME_MAX_LENGTH} onSubmitEditing={save} autoFocus />
        <Text style={styles.hint}>{profile.nicknameHint}</Text>
      </View>
      <ErrorLine text={error} />
      <Button title={saving ? profile.saving : profile.save} onPress={save} disabled={!canSave} loading={saving} />
    </>
  );
}

export function PhoneSheet({ current, saving, error, onSave }: SaveProps & { current: string; onSave: (phone: string) => void }) {
  const [phone, setPhone] = useState(current);
  const canSave = phoneSchema.safeParse(phone).success && !saving;

  function save() {
    if (!canSave) {
      return;
    }
    onSave(phone);
  }

  return (
    <>
      <TextField
        label={profile.phoneLabel}
        value={phone}
        onChangeText={setPhone}
        keyboardType="number-pad"
        maxLength={11}
        autoComplete="tel"
        onSubmitEditing={save}
        autoFocus
      />
      <ErrorLine text={error} />
      <Button title={saving ? profile.saving : profile.save} onPress={save} disabled={!canSave} loading={saving} />
    </>
  );
}

export function DeleteSheet({ deleting, error, onDelete, onCancel }: { deleting: boolean; error: string; onDelete: () => void; onCancel: () => void }) {
  return (
    <>
      <Text accessibilityRole="header" style={styles.title}>
        {profile.deleteTitle}
      </Text>
      <Text style={styles.message}>{profile.deleteMessage}</Text>
      <ErrorLine text={error} />
      <Button title={profile.deleteAccount} onPress={onDelete} variant="danger" loading={deleting} />
      <Button title={profile.cancel} onPress={onCancel} variant="secondary" disabled={deleting} />
    </>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 19, fontFamily: fonts.display },
  message: { color: colors.textSoft, fontSize: 15, lineHeight: 22, fontFamily: fonts.regular },
  field: { gap: 7 },
  hint: { color: colors.muted, fontSize: 12.5, fontFamily: fonts.medium },
});
