import { Pressable, StyleSheet, Text, View } from "react-native";
import { PROFILE_NAME_MAX_LENGTH } from "@pontinho/api-contract";
import { Avatar } from "@/shared/ui/Avatar";
import { MenuScreen } from "@/shared/ui/MenuScreen";
import { TextField } from "@/shared/ui/TextField";
import { WoodButton } from "@/shared/ui/WoodButton";
import { colors } from "@/shared/theme/colors";
import home from "@/messages/home.json";
import profile from "@/messages/profile.json";
import { BIRTH_DATE_INPUT_LENGTH } from "./birthDate";
import { useProfileSetup } from "./useProfileSetup";

export function ProfileSetupScreen() {
  const setup = useProfileSetup();
  const photoTitle = setup.photoUri ? profile.changePhoto : profile.choosePhoto;

  return (
    <MenuScreen title={home.title} error={setup.error}>
      <View style={styles.form}>
        <Pressable onPress={setup.pickPhoto} style={styles.photo}>
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
        <WoodButton title={setup.saving ? profile.saving : profile.save} onPress={setup.submit} disabled={!setup.canSave || setup.saving} large />
      </View>
    </MenuScreen>
  );
}

const styles = StyleSheet.create({
  form: { alignItems: "center", gap: 14 },
  photo: { alignItems: "center", gap: 6 },
  photoText: { color: colors.woodText, fontSize: 15, fontWeight: "600" },
});
