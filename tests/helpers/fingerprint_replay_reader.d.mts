import type { ReviewAssetReader } from "../../dist/review/assets.js";

export function fingerprintReplayReader(reader: ReviewAssetReader): {
  observed: ReviewAssetReader;
  replay: ReviewAssetReader;
};
