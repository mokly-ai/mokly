import { useToast } from "@firna/ui/toast";
import { Caption } from "@firna/ui/typography";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import type { ShareLink } from "../../api/types";
import { Action } from "../../components/action";
import { StatusBadge } from "../../components/controls";
import { Field } from "../../components/field";
import { TextBar } from "../../components/placeholders";
import { writeFailure } from "../../components/write-failure";
import { useCompact } from "../../layout/viewport";

/** What the reader is told about who can open the link they are copying. */
const accessCopy = {
  public: "Anyone with the link can view.",
  members: "Project members can open this link.",
} as const;

/** The project's visibility, which the panel knows before the link. */
type Visibility = "private" | "public";

/**
 * The link, Copy link beside it and who can open it, as the prepared link and
 * its wait both draw them, and as the catalogue's `ShareLink` draws them: the
 * field and the control in one row, then the line beside the visibility's
 * badge. On a phone the control takes the panel's width under the field.
 */
function LinkLayout({
  field,
  visibility,
  access,
  copy,
}: {
  field: ReactNode;
  visibility: Visibility;
  access: ReactNode;
  copy: ReactNode;
}) {
  return (
    <>
      <div className="fo-canvas-share-link">
        {field}
        {copy}
      </div>
      <div className="review-inline fo-canvas-share-access">
        <StatusBadge label={visibility === "public" ? "Public" : "Private"} />
        <Caption color="muted">{access}</Caption>
      </div>
    </>
  );
}

/** Copy link, which waits disabled until there is a link to copy. */
function CopyLink({ onCopy }: { onCopy?: () => void }) {
  const compact = useCompact();
  return (
    <Action
      label="Copy link"
      tone="primary"
      size="md"
      block={compact}
      disabled={onCopy === undefined}
      onPress={onCopy}
      testID="share-copy"
    />
  );
}

/** The prepared link, who can open it, and Copy link. */
export function Link({
  link,
  visibility,
}: {
  link: ShareLink;
  visibility: Visibility;
}) {
  const { toast } = useToast();
  const [refused, setRefused] = useState(false);
  const copy = useCallback(async () => {
    const clipboard = globalThis.navigator.clipboard;
    try {
      if (!clipboard) throw new Error("no clipboard");
      await clipboard.writeText(link.url);
    } catch {
      setRefused(true);
      return;
    }
    setRefused(false);
    toast({ title: "Link copied", tone: "success", variant: "solid" });
  }, [link.url, toast]);
  return (
    <LinkLayout
      field={
        <Field
          label="Publication link"
          name="publication-link"
          value={link.url}
          readOnly
          onChange={() => undefined}
        />
      }
      visibility={visibility}
      access={accessCopy[link.access]}
      copy={
        // A clipboard the browser refused was never a request Mokly
        // answered, so there is no reference to disclose and the control
        // keeps its own label: there is nothing to send again.
        writeFailure(
          refused
            ? "Copying didn’t work here. Select the link above and copy it."
            : undefined,
          undefined,
          <CopyLink onCopy={() => void copy()} />,
        )
      }
    />
  );
}

/**
 * The link while the panel reads it, as the catalogue draws it. `hold` is the
 * read's name, and the field is the place that names it: the field keeps its
 * label and its own frame, read only, and holds the name where the link would
 * be. The visibility is the project's, so its badge stays; who can open the
 * link is the read's, so that line is a bar; and Copy link, whose label is
 * known, draws itself disabled.
 */
export function LinkWait({
  hold,
  visibility,
}: {
  hold: ReactNode;
  visibility: Visibility;
}) {
  return (
    <LinkLayout
      field={
        <Field
          label="Publication link"
          name="publication-link"
          waiting
          hold={hold}
        />
      }
      visibility={visibility}
      access={<TextBar width="16em" />}
      copy={<CopyLink />}
    />
  );
}
