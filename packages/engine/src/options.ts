export type OptionRole = "ordinary" | "all_of_above" | "none_of_above";
export interface ExamOption {
  id: string;
  text: string;
  role: OptionRole;
}

export function shuffleOptionsPreservingSpecial(
  options: readonly ExamOption[],
  random: () => number = Math.random,
): ExamOption[] {
  const ids = new Set<string>();
  for (const option of options) {
    if (ids.has(option.id)) throw new Error("Option IDs must be unique and stable.");
    ids.add(option.id);
  }
  const result = [...options];
  const positions: number[] = [];
  const movable: ExamOption[] = [];
  for (let i = 0; i < options.length; i += 1) {
    const option = options[i];
    if (option?.role === "ordinary") {
      positions.push(i);
      movable.push(option);
    }
  }
  for (let i = movable.length - 1; i > 0; i -= 1) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new RangeError("The random function must return a finite value in [0, 1).");
    }
    const j = Math.floor(sample * (i + 1));
    const current = movable[i];
    const swap = movable[j];
    if (!current || !swap) continue;
    movable[i] = swap;
    movable[j] = current;
  }
  for (let i = 0; i < positions.length; i += 1) {
    const position = positions[i];
    const option = movable[i];
    if (position !== undefined && option !== undefined) result[position] = option;
  }
  return result;
}
