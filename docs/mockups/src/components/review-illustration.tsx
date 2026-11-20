import { ArtTile } from "./illustrations/art-tiles";
import { Motif } from "./illustrations/motif";
import {
  BrowserScene,
  ProductScene,
  ReviewPanel,
} from "./illustrations/product-scene";
import { componentInput } from "./metadata";

const details = [
  "full",
  "review",
  "screens",
  "flow",
  "changes",
  "code",
  "grid",
  "branch",
] as const;

export const reviewIllustrationInput = componentInput({
  title: "Review illustration",
  description:
    "Fictional website-launch material in the selected Fieldnotes style. Browser and phone frames belong to the illustration, not the owning screen's device chrome.",
  relatedDocs: [
    "docs/protocol/cloud/marketing-site.md",
    "docs/protocol/cloud/design-tokens.md",
    "docs/protocol/cloud/design-tokens-color.md",
  ],
  propSchema: {
    type: "object",
    additionalProperties: false,
    required: ["detail"],
    properties: { detail: { enum: details } },
  },
  props: { detail: "full" },
  controls: {
    detail: {
      kind: "select",
      options: details.map((value) => ({ label: value, value })),
    },
  },
  render: ({ detail }) => {
    // A motif is an inline symbol and a scene is a block, so both compose
    // valid TSX wherever a screen places them.
    const symbol = ["code", "grid", "branch"].includes(detail);
    const Frame = symbol ? "span" : "div";
    return (
      <Frame
        className={
          "review-illustration paper-scope illustration-" +
          detail +
          (symbol ? " illustration-symbol" : "")
        }
        role="img"
        aria-hidden={symbol || undefined}
        aria-label={
          detail === "full" || detail === "review"
            ? "Website launch screen and its review, illustrated"
            : "Illustrated " + detail
        }
      >
        {detail === "code" || detail === "grid" || detail === "branch" ? (
          <Motif kind={detail} />
        ) : detail === "review" ? (
          <ReviewPanel />
        ) : detail !== "full" ? (
          <ArtTile detail={detail} />
        ) : (
          <div className="fieldnotes-canvas">
            <BrowserScene />
            <div className="floating-note">
              <span>✓</span>
              <div>
                One shared picture.<small>Every screen, connected.</small>
              </div>
            </div>
            <div className="floating-phone">
              <span className="phone-speaker" />
              <ProductScene compact />
            </div>
            <span className="handwritten-caption">The whole picture ↗</span>
          </div>
        )}
      </Frame>
    );
  },
  variants: [
    {
      slug: "fieldnotes",
      title: "Fieldnotes",
      props: { detail: "full" },
    },
    {
      slug: "review",
      title: "Screen review",
      props: { detail: "review" },
    },
    {
      slug: "screens",
      title: "Screen art",
      props: { detail: "screens" },
    },
    {
      slug: "flow",
      title: "Journey art",
      props: { detail: "flow" },
    },
    {
      slug: "changes",
      title: "Change art",
      props: { detail: "changes" },
    },
  ],
});
