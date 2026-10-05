const SECTIONS = [
  [
    "Before you start",
    "Open the catalogue, pick a screen, and keep this guide beside it.",
  ],
  [
    "Reading a screen",
    "Every screen shows its title, its place in the catalogue, and the notes recorded with it.",
  ],
  [
    "Following the tour",
    "The tour walks through the same screens in the order a new reader meets them.",
  ],
  [
    "Sharing a screen",
    "Copy the address from the frame and send it on; it opens the same screen for everyone.",
  ],
  [
    "Keeping notes",
    "Notes live beside the screen they describe, so they stay together as the catalogue grows.",
  ],
  [
    "Where to go next",
    "Return to the handbook whenever a screen raises a question this guide does not answer.",
  ],
] as const;

const page = {
  background: "white",
  color: "#1a1d1c",
  fontFamily: "sans-serif",
  margin: "0 auto",
  maxWidth: "720px",
  padding: "32px",
} as const;

const index = {
  background: "#f6f6f3",
  borderRadius: "8px",
  listStyle: "none",
  margin: "0 0 28px",
  padding: "16px 20px",
} as const;

/**
 * A long example field guide, kept as it read before the document was removed.
 * Its section index and headings stay addressable within the document.
 */
export function RemovedFieldGuide() {
  return (
    <article style={page}>
      <p>Example field guide</p>
      <h1 id="field-guide">Field guide</h1>
      <p>
        A longer companion to the handbook, written for readers who work through
        the catalogue one screen at a time.
      </p>
      <ul style={index}>
        {SECTIONS.map(([title]) => (
          <li key={title}>{title}</li>
        ))}
      </ul>
      {SECTIONS.map(([title, body]) => (
        <section key={title}>
          <h2 id={title.toLowerCase().replaceAll(" ", "-")}>{title}</h2>
          <p>{body}</p>
          <p>
            Take the screens in any order. The guide repeats the essentials so a
            single section can stand on its own.
          </p>
        </section>
      ))}
    </article>
  );
}
