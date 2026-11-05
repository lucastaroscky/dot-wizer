import { StyleSheet, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import { fetchDevAccounts, startDevLogin } from "@/shared/api/devLogin";
import { Button } from "@/shared/ui/Button";
import { ErrorLine } from "@/shared/ui/Notice";
import auth from "@/messages/auth.json";

export function DevLogin() {
  const accounts = useQuery({ queryKey: ["devAccounts"], queryFn: fetchDevAccounts, retry: false });
  const login = useMutation({ mutationFn: startDevLogin });

  if (!accounts.data?.accounts.length) {
    return null;
  }
  return (
    <View style={styles.list}>
      {accounts.data.accounts.map((account, index) => (
        <Button
          key={account}
          title={auth.devLogin.replace("{number}", String(index + 1))}
          onPress={() => login.mutate({ account })}
          variant="secondary"
          loading={login.isPending && login.variables.account === account}
          disabled={login.isPending}
        />
      ))}
      <ErrorLine text={login.error?.message ?? ""} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
});
