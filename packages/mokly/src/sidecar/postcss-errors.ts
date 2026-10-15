import type { PostcssFailure } from "../generated/sidecar/PostcssFailure.js";

/** Worker failures retain structured context until Rust selects the terminal text. */
export class PostcssError extends Error {
  constructor(readonly failure: PostcssFailure) {
    super(
      "detail" in failure ? failure.detail : `PostCSS ${failure.kind} failure`,
    );
  }
}
