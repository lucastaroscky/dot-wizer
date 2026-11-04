import { Pressable, StyleSheet, Text, View } from "react-native";
import { PROFILE_NAME_MAX_LENGTH } from "@pontinho/api-contract";
import { Avatar } from "@/shared/ui/Avatar";
import { Button } from "@/shared/ui/Button";
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
  const photoTitle = setup.photoUri ? profile.changePhoto : profile.choosePhoto;

  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        {profile.title}
      </Text>
      <Pressable onPress={setup.pickPhoto} accessibilityRole="button" style={styles.photo}>
        <Avatar name={setup.name} size={88} photoUrl={setup.photoUri} />
        <Text style={styles.photoText}>{photoTitle}</Text>
      </Pressable>
      <TextField label={profile.nameLabel} value={setup.name} onChangeText={setup.setName} maxLength={PROFILE_NAME_MAX_LENGTH} autoComplete="name" />
      <TextField
        label={profile.birthDateLabel}
        value={setup.birthDateText}
        onChangeText={setup.changeBirthDate}
        placeholder={profile.birthDatePlaceholder}
        keyboardType="number-pad"
        maxLength={BIRTH_DATE_INPUT_LENGTH}
        onBlur={setup.leaveBirthDate}
        error={setup.birthDateError}
        onSubmitEditing={setup.submit}
      />
      <View style={styles.footer}>
        {setup.error !== "" && <Notice text={setup.error} tone="danger" />}
        <Button title={setup.saving ? profile.saving : profile.save} onPress={setup.submit} disabled={!setup.canSave} loading={setup.saving} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 12, color: colors.text, fontSize: 24, fontFamily: fonts.display },
  photo: { alignSelf: "center", alignItems: "center", gap: 8, paddingVertical: 12 },
  photoText: { color: colors.textSoft, fontSize: 15, fontFamily: fonts.semibold },
  footer: { marginTop: "auto", gap: 14 },
});
