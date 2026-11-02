const ADULT_AGE = 18;

interface IsAdultInput {
  birthDate: string;
  today: string;
}

export function isAdult({ birthDate, today }: IsAdultInput): boolean {
  const yearsSinceBirthYear = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  const monthAndDay = (isoDate: string) => isoDate.slice(5);
  if (monthAndDay(today) < monthAndDay(birthDate)) {
    return yearsSinceBirthYear - 1 >= ADULT_AGE;
  }
  return yearsSinceBirthYear >= ADULT_AGE;
}
