import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import aesjs from "aes-js";
import type { SupportedStorage } from "@supabase/supabase-js";

const KEY_BYTES = 32;
const COUNTER_START = 1;

function createCipher(keyBytes: Uint8Array) {
  return new aesjs.ModeOfOperation.ctr(keyBytes, new aesjs.Counter(COUNTER_START));
}

async function encrypt(key: string, value: string) {
  const keyBytes = Crypto.getRandomBytes(KEY_BYTES);
  await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(keyBytes));
  const encrypted = createCipher(keyBytes).encrypt(aesjs.utils.utf8.toBytes(value));
  return aesjs.utils.hex.fromBytes(encrypted);
}

async function decrypt(key: string, value: string) {
  const keyHex = await SecureStore.getItemAsync(key);
  if (!keyHex) {
    return null;
  }
  const decrypted = createCipher(aesjs.utils.hex.toBytes(keyHex)).decrypt(aesjs.utils.hex.toBytes(value));
  return aesjs.utils.utf8.fromBytes(decrypted);
}

export const authStorage: SupportedStorage = {
  async getItem(key) {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) {
      return null;
    }
    return decrypt(key, encrypted);
  },
  async setItem(key, value) {
    await AsyncStorage.setItem(key, await encrypt(key, value));
  },
  async removeItem(key) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key);
  },
};
