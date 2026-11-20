import { useLocalSearchParams } from "expo-router";

import { InvitationAcceptScreen } from "../../../../../src/screens/account/invitation-accept-screen";

/** Finish an invitation after the invited address signs in. */
export default function AcceptInvitation() {
  const { workspaceId, memberId } = useLocalSearchParams<{
    workspaceId: string;
    memberId: string;
  }>();
  return (
    <InvitationAcceptScreen workspaceId={workspaceId} memberId={memberId} />
  );
}
