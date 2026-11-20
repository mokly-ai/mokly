import { useToast } from "@firna/ui/toast";
import { Body } from "@firna/ui/typography";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import type { ShareLink } from "../../api/types";
import { Action } from "../../components/action";
import { StatusBadge } from "../../components/controls";
import { Field } from "../../components/field";
import { TextBar } from "../../components/placeholders";
import { writeFailure } from "../../components/write-failure";

/** What the reader is told about who can open the link they are copying. */
const accessCopy = {
  public: "Anyone with the link can view.",
  members: "Project members can open this link.",
} as const;

/** The project's visibility, which the panel knows before the link. */
type Visibility = "private" | "public";

/**
 * The link, who can open it and Copy link, as the prepared link and its wait
 * both draw them: the field, the line beside the visibility's badge, and the
 * control at the panel's foot.
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
      {field}
      <div className="review-inline">
        <StatusBadge label={visibility === "public" ? "Public" : "Private"} />
        <Body color="muted">{access}</Body>
      </div>
      {copy}
    </>
  );
}

/** Copy link, which waits disabled until there is a link to copy. */
function CopyLink({ onCopy }: { onCopy?: () => void }) {
  return (
    <div className="fo-panel-foot">
      <Action
        label="Copy link"
        tone="primary"
        size="md"
        disabled={onCopy === undefined}
        onPress={onCopy}
        testID="share-copy"
      />
    </div>
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
