const chipsFormat = new Intl.NumberFormat("pt-BR");
const signedChipsFormat = new Intl.NumberFormat("pt-BR", { signDisplay: "exceptZero" });
const reaisFormat = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const CENTS_PER_REAL = 100;

export function formatChips(chips: number) {
  return chipsFormat.format(chips);
}

export function formatSignedChips(chips: number) {
  return signedChipsFormat.format(chips);
}

export function formatReais(cents: number) {
  return reaisFormat.format(cents / CENTS_PER_REAL);
}
