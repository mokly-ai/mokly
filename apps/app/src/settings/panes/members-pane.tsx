import { useCallback, useState } from "react";
import type { ReactNode } from "react";

import type { Member, Workspace } from "../../api/types";
import { Pending, Section } from "../../components/page-parts";
import type { SectionTitle } from "../../components/page-parts";
import { listMembers, removeMember } from "../../data/workspaces";
import { useResource } from "../../data/use-resource";
import { PaneResource } from "../../components/resource-state";
import { MemberDetails } from "./member-details";
import { InviteForm, InviteWait } from "./member-invite";
import {
  InvitationRows,
  InvitationsWait,
  MemberRows,
  PeopleWait,
} from "./member-rows";
import { useSeatCosts } from "./seat-cost";

/**
 * The Members pane's layout, which the pane and its waits both draw: the
 * people beside the invitations, then the invite form beside the person the
 * reader manages. `named` gives a heading that names the workspace.
 */
function MembersLayout({
  named,
  people,
  invitations,
  invite,
  managed,
}: {
  named: (words: string) => SectionTitle;
  people: ReactNode;
  invitations: ReactNode;
  invite: ReactNode;
  managed?: ReactNode;
}) {
  return (
    <div className="fo-stack">
      <div className="fo-two-columns">
        <Section title={named("People in")}>{people}</Section>
        <Section title="Invitations">{invitations}</Section>
      </div>
      <div className="fo-two-columns">
        <Section title={named("Invite to")}>{invite}</Section>
        {managed}
      </div>
    </div>
  );
}

/**
 * The pane while the members are read, or, with no `workspace`, while the
 * settings scope loads. Every part keeps its place and draws its waiting form:
 * each list draws one placeholder row, the field waits in its frame, and the
 * roles and Send invitation, whose labels are known, draw themselves disabled.
 * Nobody is managed, because the pane selects nobody until the reader asks.
 * The seat's price waits as a bar where the form names one: on Team, for the
 * readers who administer the workspace, the most common form while the scope
 * is not known. A heading that names the workspace keeps its known words
 * beside a bar while the scope loads.
 */
export function MembersWait({ workspace }: { workspace?: Workspace }) {
  const administers =
    workspace === undefined ||
    workspace.role === "owner" ||
    workspace.role === "admin";
  const seat = administers && (workspace?.plan ?? "team") === "team";
  return (
    <MembersLayout
      named={(words) =>
        workspace ? words + " " + workspace.name : { before: words, bar: "3em" }
      }
      people={<PeopleWait />}
      invitations={<InvitationsWait />}
      invite={<InviteWait seat={seat} />}
    />
  );
}

/** People, roles, pending invitations and the invite form. */
export function MembersPane({ workspace }: { workspace: Workspace }) {
  const members = useResource(
    () => listMembers(workspace.id),
    "members:" + workspace.id,
  );
  // Read beside the members, so the seat's price is there with the form.
  const costs = useSeatCosts(workspace);
  const [selected, setSelected] = useState<Member | undefined>(undefined);

  const revoke = useCallback(
    async (person: Member) => {
      await removeMember(workspace.id, person.id, person.version);
      members.reload();
    },
    [workspace.id, members],
  );

  return (
    <PaneResource
      resource={members.state}
      waiting={
        <Pending label="Loading members" labelMode="screen-reader-only">
          <MembersWait workspace={workspace} />
        </Pending>
      }
      failure="Members couldn’t load"
      onRetry={members.reload}
    >
      {(items) => (
        <MembersLayout
          named={(words) => words + " " + workspace.name}
          people={
            <MemberRows
              members={items.filter((person) => person.status === "active")}
              onSelect={setSelected}
            />
          }
          invitations={
            <InvitationRows
              invited={items.filter((person) => person.status === "invited")}
              revoke={revoke}
            />
          }
          invite={
            <InviteForm
              workspace={workspace}
              costs={costs}
              onInvited={members.reload}
            />
          }
          managed={
            selected && (
              // Keyed by the person: the panel's role and its removal
              // confirmation belong to whoever is selected, and must not be
              // handed to the next one.
              <Section title={"Manage " + selected.name} labelled>
                <MemberDetails
                  key={selected.id}
                  member={selected}
                  workspace={workspace}
                  onChanged={() => {
                    setSelected(undefined);
                    members.reload();
                  }}
                />
              </Section>
            )
          }
        />
      )}
    </PaneResource>
  );
}
