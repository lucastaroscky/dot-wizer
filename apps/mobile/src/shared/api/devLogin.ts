import { useSyncExternalStore } from "react";
import type { DevAccountsResponse, DevLoginBody, DevLoginResponse } from "@pontinho/api-contract";
import { API_URL } from "@/shared/config/env";
import errors from "@/messages/errors.json";
import { fetchWithTimeout } from "./fetchWithTimeout";

const STORAGE_KEY = "pontinho.devLogin";
const listeners = new Set<() => void>();
let current = readStored();

function readStored(): DevLoginResponse | undefined {
  const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (!stored) {
    return undefined;
  }
  return JSON.parse(stored);
}

function save(login: DevLoginResponse | undefined) {
  current = login;
  if (login) {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(login));
  } else {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentDevLogin() {
  return current;
}

export function endDevLogin() {
  save(undefined);
}

export function useDevLogin() {
  return useSyncExternalStore(subscribe, () => current, () => undefined);
}

export async function fetchDevAccounts(): Promise<DevAccountsResponse> {
  const response = await fetchWithTimeout(`${API_URL}/dev/login`);
  if (!response.ok) {
    return { accounts: [] };
  }
  return response.json();
}

export async function startDevLogin(body: DevLoginBody) {
  const response = await fetchWithTimeout(`${API_URL}/dev/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(errors.generic);
  }
  save(await response.json());
}
