export function captureAssets(serverUrl: string, stage: string): Promise<void>;
export function capturePage(
  serverUrl: string,
  route: string,
  stage: string,
  relativePath: string,
  expectedStatus?: number,
): Promise<void>;
export function writeText(
  root: string,
  relative: string,
  content: string,
): Promise<void>;
