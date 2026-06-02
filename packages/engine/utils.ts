export function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function shuffleAnchored<T>(
  array: (T & { anchor?: "first" | "last" })[]
): (T & { anchor?: "first" | "last" })[] {
  const firsts = array.filter((o) => o.anchor === "first");
  const lasts = array.filter((o) => o.anchor === "last");
  const middle = array.filter((o) => !o.anchor);
  return [...firsts, ...shuffle(middle), ...lasts];
}

export function isDefined<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
