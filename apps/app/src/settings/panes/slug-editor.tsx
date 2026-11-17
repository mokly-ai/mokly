import { useCallback, useEffect, useRef } from "react";

import { formFailure, slugFieldOwners } from "../../components/form-failure";
import { Action } from "../../components/action";
import { Field } from "../../components/field";
import { AddressPreview } from "../../components/page-parts";
import { useAddressPathname, useAddressSearch } from "../../navigation/address";
import { useSettings } from "../context";
import { useDirtyState, useDraft } from "../dirty";
import { draftKey } from "../drafts";
import { useWrite } from "../write";

interface SavedSlug {
  slug: string;
  workspaceSlug?: string;
}

/** Shared nested address editor for workspace and project settings. */
export function SlugEditor({
  subject,
  subjectId,
  current,
  address,
  save,
  canonicalAddress,
}: {
  subject: "workspace" | "project";
  subjectId: string;
  current: string;
  address: (slug: string) => string;
  save: (slug: string) => Promise<SavedSlug>;
  canonicalAddress: (
    pathname: string,
    search: string,
    saved: SavedSlug,
  ) => string;
}) {
  const pathname = useAddressPathname();
  const search = useAddressSearch();
  const { reload, replaceRoute, closePaneView } = useSettings();
  const drafts = useDirtyState();
  const fieldKey = draftKey(subject, subjectId, "slug");
  const [slug, setSlug] = useDraft(fieldKey, current, [], "exact");
  const destination = useRef("");
  const attemptedSlug = useRef("");
  const done = useCallback(() => {
    const href = destination.current;
    destination.current = "";
    if (href) replaceRoute(href);
  }, [replaceRoute]);
  const write = useWrite(done, slug.length > 0 && slug !== current);
  useEffect(() => {
    if (write.error && attemptedSlug.current !== slug) write.clearError();
  }, [slug, write]);
  const submit = useCallback(
    () =>
      write.run(async () => {
        attemptedSlug.current = slug;
        const saved = await save(slug);
        drafts.forget(fieldKey);
        destination.current = canonicalAddress(pathname, search, saved);
      }),
    [canonicalAddress, drafts, fieldKey, pathname, save, search, slug, write],
  );
  const failure = formFailure(write, slugFieldOwners);
  const conflict = write.error?.reason === "version-conflict";
  const error =
    slug.length === 0
      ? "Use lowercase letters, numbers and single hyphens."
      : failure.on("slug");
  const field = subject === "workspace" ? "Workspace slug" : "Project slug";

  const control = (
    <Action
      label={
        conflict
          ? "Reopen"
          : failure.label("Save changes", "Saving…", "Try again")
      }
      tone="primary"
      size="md"
      write={write}
      operation={`Saving ${subject} address`}
      disabled={conflict ? false : write.disabled}
      onPress={
        conflict
          ? () => {
              reload();
              drafts.forget(fieldKey);
              closePaneView();
            }
          : () => void submit()
      }
      testID={`save-${subject}-slug`}
    />
  );

  return (
    <div className="fo-stack" data-mkc-screen={`settings-${subject}-slug`}>
      <section className="fo-section fo-section-flush">
        <div className="fo-form">
          <Field
            label={field}
            name={`${subject}-slug`}
            type="identifier"
            value={slug}
            onChange={setSlug}
            disabled={write.working}
            error={error}
          />
          <AddressPreview path={address(slug)} />
          <p className="fo-copy">Old links keep working.</p>
          {failure.around(<div>{control}</div>)}
        </div>
      </section>
    </div>
  );
}
