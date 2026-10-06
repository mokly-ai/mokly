export function covered(value) {
  if (value > 0) return "positive";
  return "other";
}

export function uncovered() {
  return "never executed by the coverage fixture";
}
