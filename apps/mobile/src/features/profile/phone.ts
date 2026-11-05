import { phoneSchema } from "@pontinho/api-contract";

const PHONE_DIGITS = 11;
export const PHONE_INPUT_LENGTH = 15;

export function phoneDigits(text: string) {
  return text.replace(/\D/g, "").slice(0, PHONE_DIGITS);
}

export function isValidPhone(digits: string) {
  return phoneSchema.safeParse(digits).success;
}

export function formatPhone(text: string) {
  const digits = phoneDigits(text);
  if (digits.length <= 2) {
    return digits;
  }
  const areaCode = `(${digits.slice(0, 2)}) `;
  if (digits.length <= 7) {
    return areaCode + digits.slice(2);
  }
  return `${areaCode}${digits.slice(2, 7)}-${digits.slice(7)}`;
}
