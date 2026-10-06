export interface NodeCoverageLine {
  line: number;
  count: number;
}

export interface NodeCoverageFunction {
  name: string;
  line: number;
  count: number;
}

export interface NodeCoverageTracefileInput {
  workingDirectory: string;
  files: readonly {
    path: string;
    lines: readonly NodeCoverageLine[];
    branches: readonly NodeCoverageLine[];
    functions: readonly NodeCoverageFunction[];
    totalLineCount: number;
    coveredLineCount: number;
    totalBranchCount: number;
    coveredBranchCount: number;
    totalFunctionCount: number;
    coveredFunctionCount: number;
  }[];
}

export default function coverageReporter(
  source: AsyncIterable<{ type: string; data: unknown }>,
): AsyncGenerator<string, void, undefined>;

export function lcovTracefile(summary: NodeCoverageTracefileInput): string;
