const serverUrl = process.env.EXPO_PUBLIC_SERVER_URL;

if (!serverUrl) {
  throw new Error("Defina EXPO_PUBLIC_SERVER_URL no .env.local do app");
}

export const SERVER_URL = serverUrl;
