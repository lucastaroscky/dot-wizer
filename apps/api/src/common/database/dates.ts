export function toIsoDate({ date }: { date: Date }): string {
  return date.toISOString().slice(0, 10);
}

export function fromIsoDate({ isoDate }: { isoDate: string }): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}
