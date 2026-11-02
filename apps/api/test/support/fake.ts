export function fake<T>(implementation: Partial<T>): T {
  return implementation as T;
}
