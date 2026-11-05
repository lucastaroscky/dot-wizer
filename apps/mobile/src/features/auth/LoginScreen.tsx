import { StyleSheet, Text, View } from "react-native";
import { SESSION_END_TEXTS, useSessionEndReason } from "@/shared/api/sessionEnd";
import { Button } from "@/shared/ui/Button";
import { CardTrio } from "@/shared/ui/CardTrio";
import { Logo } from "@/shared/ui/Logo";
import { ErrorLine, Notice } from "@/shared/ui/Notice";
import { Screen } from "@/shared/ui/Screen";
import { TextField } from "@/shared/ui/TextField";
import { colors } from "@/shared/theme/colors";
import { fonts } from "@/shared/theme/fonts";
import auth from "@/messages/auth.json";
import { CodeField } from "@/shared/ui/CodeField";
import type { GoogleLogin } from "./GoogleLogin";
import { useEmailLogin } from "./useEmailLogin";
import { useGoogleLogin } from "./useGoogleLogin";

type EmailLogin = ReturnType<typeof useEmailLogin>;

function EmailStep({ login, google }: { login: EmailLogin; google: GoogleLogin }) {
  return (
    <>
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
        error={login.error}
      />
      <Button
        title={login.sending ? auth.sending : auth.sendCode}
        onPress={login.requestCode}
        disabled={!login.canRequestCode}
        loading={login.sending}
      />
      <Button
        title={google.status === "checking" ? auth.checking : auth.google}
        onPress={google.signIn}
        variant="secondary"
        loading={google.status !== "idle"}
      />
      <ErrorLine text={google.error} />
    </>
  );
}

function CodeStep({ login }: { login: EmailLogin }) {
  return (
    <>
      <Text style={styles.hint}>{auth.codeSentTo.replace("{email}", login.email.trim())}</Text>
      <CodeField value={login.code} onChange={login.setCode} onSubmit={login.confirmCode} invalid={login.error !== ""} />
      <ErrorLine text={login.error} />
      <Button
        title={login.checking ? auth.checking : auth.confirmCode}
        onPress={login.confirmCode}
        disabled={!login.canConfirmCode}
        loading={login.checking}
      />
      <Button title={auth.changeEmail} onPress={login.changeEmail} variant="plain" />
    </>
  );
}

export function LoginScreen() {
  const login = useEmailLogin();
  const google = useGoogleLogin();
  const sessionEnd = useSessionEndReason();

  return (
    <Screen glow>
      <View style={styles.hero}>
        <CardTrio width={60} />
        <Logo size={34} />
      </View>
      {sessionEnd && <Notice text={SESSION_END_TEXTS[sessionEnd]} tone={sessionEnd === "expired" ? "neutral" : "danger"} />}
      {login.codeSent ? <CodeStep login={login} /> : <EmailStep login={login} google={google} />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, minHeight: 260, alignItems: "center", justifyContent: "center", gap: 22 },
  hint: { color: colors.textSoft, fontSize: 15, fontFamily: fonts.regular, lineHeight: 22 },
});
