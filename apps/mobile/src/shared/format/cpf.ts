const CPF_DIGITS = 11;
export const CPF_INPUT_LENGTH = 14;

export function cpfDigits(text: string) {
  return text.replace(/\D/g, "").slice(0, CPF_DIGITS);
}

export function formatCpf(text: string) {
  const digits = cpfDigits(text);
  const groups = [digits.slice(0, 3), digits.slice(3, 6), digits.slice(6, 9)].filter((group) => group.length > 0).join(".");
  const checkDigits = digits.slice(9);
  if (!checkDigits) {
    return groups;
  }
  return `${groups}-${checkDigits}`;
}

export function maskCpf(cpf: string) {
  return `${cpf.slice(0, 3)}.•••.•••-${cpf.slice(9)}`;
}
