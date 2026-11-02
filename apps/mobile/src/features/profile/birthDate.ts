export const BIRTH_DATE_INPUT_LENGTH = 10;
const DAY_LENGTH = 2;
const MONTH_END = 4;
const MAX_DIGITS = 8;
const DATE_PATTERN = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function formatBirthDateInput(text: string) {
  const digits = text.replace(/\D/g, "").slice(0, MAX_DIGITS);
  const parts = [digits.slice(0, DAY_LENGTH), digits.slice(DAY_LENGTH, MONTH_END), digits.slice(MONTH_END)];
  return parts.filter((part) => part.length > 0).join("/");
}

export function toIsoDate(text: string) {
  const match = DATE_PATTERN.exec(text);
  if (!match) {
    return undefined;
  }
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  const isRealDate = date.getUTCDate() === Number(day) && date.getUTCMonth() === Number(month) - 1;
  if (!isRealDate) {
    return undefined;
  }
  return `${year}-${month}-${day}`;
}
