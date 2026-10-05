import { PublishAccounting } from "./accounting.js";
import { uploadMissingBlobs } from "./blobs.js";
import { completeUpload } from "./complete.js";
import { invalidBundle, uploadFailed } from "./errors.js";
import {
  buildPlanArchive,
  requestUploadPlan,
  selectPlanArchiveFiles,
  type UploadRequestDependencies,
} from "./plan.js";
import { ReplanRequired } from "./retry.js";
import type { UploadSnapshot } from "./snapshot.js";
import type { PublishProgress, PublishResult, UploadOptions } from "./types.js";

/** Transport options used by the exchange after export preparation. */
export interface ExchangeOptions extends UploadOptions {
  uploadConcurrency?: number;
}

/** Injectable transport and presentation boundaries for the exchange. */
export interface ExchangeDependencies extends UploadRequestDependencies {
  progress?: PublishProgress;
}

/** Exchange one validated export snapshot through Plan, Blobs and Complete. */
export async function exchangeUpload(
  snapshot: UploadSnapshot,
  options: ExchangeOptions,
  dependencies: ExchangeDependencies,
  signal?: AbortSignal,
): Promise<PublishResult> {
  const planFiles = selectPlanArchiveFiles(snapshot.files, snapshot.manifest);
  const archive = await buildPlanArchive(
    snapshot.files,
    snapshot.manifest,
    signal,
  );
  const digests = new Set(snapshot.ownership.files.map(({ sha256 }) => sha256));
  const accounting = new PublishAccounting(snapshot.ownership, planFiles);
  let replanned = false;
  let showedBlobProgress = false;
  while (true) {
    const plan = await requestUploadPlan(
      options,
      archive,
      digests,
      dependencies,
      signal,
    );
    try {
      for (const digest of plan.missing) {
        if (!snapshot.blobs.has(digest))
          throw invalidBundle(
            "The upload plan requested a file outside the finalized export.",
          );
      }
      const round = accounting.startRound(plan.missing);
      if (plan.missing.length > 0) {
        showedBlobProgress = true;
        dependencies.progress?.update?.(round.progress());
      } else if (showedBlobProgress) {
        dependencies.progress?.update?.({
          completed: 0,
          total: 0,
          totalBytes: 0,
        });
      }
      await uploadMissingBlobs(
        plan,
        snapshot.blobs,
        options,
        options.uploadConcurrency ?? 8,
        dependencies,
        signal,
        (digest) => {
          dependencies.progress?.update?.(round.blobCompleted(digest));
        },
        (digest) => accounting.blobAttemptStarted(digest),
      );
      const uncommittedChanges = snapshot.manifest.uncommittedChanges;
      const completion = await completeUpload(
        plan,
        { ...options, uncommittedChanges },
        dependencies,
        signal,
      );
      return { ...completion, ...accounting.result(), uncommittedChanges };
    } catch (error) {
      if (!(error instanceof ReplanRequired)) throw error;
      if (replanned) throw uploadFailed();
      replanned = true;
    }
  }
}
