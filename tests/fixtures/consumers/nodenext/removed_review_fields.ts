import {
  defineConfig,
  type MoklyConfig,
  type ReviewConfig,
} from "@mokly/mokly";

const config: MoklyConfig = { mockupsDir: "generated" };
const removedReviewInput = { base: "main", sharedImpact: ["src/**"] };
// @ts-expect-error Removed review fields remain invalid in assigned objects.
const removedReview: ReviewConfig = removedReviewInput;
// @ts-expect-error Spreading a removed review field does not hide its type.
const removedReviewSpread: ReviewConfig = { ...removedReviewInput };
// @ts-expect-error Exact optional properties reject explicit undefined.
const undefinedReview: ReviewConfig = { base: "main", sharedImpact: undefined };
// @ts-expect-error Complete configurations reject the removed nested field.
const removedConfig: MoklyConfig = { ...config, review: removedReviewInput };
void [removedReview, removedReviewSpread, undefinedReview, removedConfig];

defineConfig({
  ...config,
  // @ts-expect-error Generic config inference rejects a removed key beside supported keys.
  review: { base: "main", outDir: ".review", sharedImpact: ["src/**"] },
});
// @ts-expect-error Generic config inference also rejects explicit undefined with exact optional properties.
defineConfig({ ...config, review: { base: "main", sharedImpact: undefined } });
// @ts-expect-error Spreading into a generic config cannot restore the removed field.
defineConfig({ ...config, review: { ...removedReviewInput } });
