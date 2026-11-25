export interface SlowTest {
  name: string;
  source: string;
  ms: number;
}

export interface SlowFile extends SlowTest {
  tests: number | null;
}

export function slowestTests(
  reports: readonly unknown[],
  limit: number,
): { tests: SlowTest[]; files: SlowFile[] };
