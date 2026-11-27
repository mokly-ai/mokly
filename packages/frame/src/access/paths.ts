import { VIEWER_DIRECTORY } from "@mokly/model";

export const accessStartPath = `/${VIEWER_DIRECTORY}/client/access-start.html`;
export const accessWorkerPath = `/${VIEWER_DIRECTORY}/client/access-worker.js`;

export function isAccessWorker(
  worker: ServiceWorker | null | undefined,
  origin: string,
): worker is ServiceWorker {
  return worker?.scriptURL === origin + accessWorkerPath;
}
