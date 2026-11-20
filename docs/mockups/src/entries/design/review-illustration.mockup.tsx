import { defineComponent } from "@mokly/mokly";

import { reviewIllustrationInput } from "../../components/review-illustration";

const reviewIllustration = defineComponent(reviewIllustrationInput);

/** The registered wrapper that screens render, so Mokly records each use. */
export const ReviewIllustration = reviewIllustration.Component;
export default reviewIllustration;
