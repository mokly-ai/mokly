import { defineScreen } from "@mokly/mokly";

export const publicationSmoke = defineScreen({
  slug: "publication-smoke",
  title: "Publication smoke",
  description: "A frozen published-CLI compatibility screen.",
  relatedDocs: [],
  render: () => (
    <main>
      <h1>Ready to review</h1>
    </main>
  ),
});
