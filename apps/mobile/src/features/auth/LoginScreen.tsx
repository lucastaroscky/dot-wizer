import { StyleSheet, Text, View } from "react-native";
import { useSessionEndText } from "@/shared/api/sessionEnd";
import { MenuScreen } from "@/shared/ui/MenuScreen";
import { TextField } from "@/shared/ui/TextField";
import { WoodButton } from "@/shared/ui/WoodButton";
import { colors } from "@/shared/theme/colors";
import auth from "@/messages/auth.json";
import home from "@/messages/home.json";
import type { GoogleLogin } from "./GoogleLogin";
import { CODE_LENGTH, useEmailLogin } from "./useEmailLogin";
import { useGoogleLogin } from "./useGoogleLogin";

type EmailLogin = ReturnType<typeof useEmailLogin>;

function EmailStep({ login, google }: { login: EmailLogin; google?: GoogleLogin }) {
  return (
    <View style={styles.form}>
      <TextField
        label={auth.emailLabel}
        value={login.email}
        onChangeText={login.setEmail}
        placeholder={auth.emailPlaceholder}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        onSubmitEditing={login.requestCode}
      />
      <WoodButton title={login.sending ? auth.sending : auth.sendCode} onPress={login.requestCode} disabled={!login.canRequestCode} large />
      {google && <WoodButton title={auth.google} onPress={google.signIn} disabled={google.pending} />}
    </View>
  );
}

function CodeStep({ login }: { login: EmailLogin }) {
  return (
    <View style={styles.form}>
      <Text style={styles.hint}>{auth.codeSentTo.replace("{email}", login.email.trim())}</Text>
      <TextField
        label={auth.codeLabel}
        value={login.code}
        onChangeText={login.setCode}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        onSubmitEditing={login.confirmCode}
      />
      <WoodButton title={login.checking ? auth.checking : auth.confirmCode} onPress={login.confirmCode} disabled={!login.canConfirmCode} large />
      <WoodButton title={auth.changeEmail} onPress={login.changeEmail} />
    </View>
  );
}

export function LoginScreen() {
  const login = useEmailLogin();
  const google = useGoogleLogin();
  const sessionEndText = useSessionEndText();

  return (
    <MenuScreen title={home.title} error={login.error || google?.error || sessionEndText}>
      {login.codeSent ? <CodeStep login={login} /> : <EmailStep login={login} google={google} />}
    </MenuScreen>
  );
}

const styles = StyleSheet.create({
  form: { alignItems: "center", gap: 14 },
  hint: { color: colors.woodText, fontSize: 15, textAlign: "center", maxWidth: 280 },
});
