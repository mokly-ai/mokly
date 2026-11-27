//! Runtime capabilities for the typed operation inventory.

use crate::operation::{Operation, OptionalConfiguration};

impl Operation {
    pub(crate) fn desktop_grant(self) -> bool {
        matches!(self, Self::IssueDesktopGrant | Self::ExchangeDesktopGrant)
    }

    pub(crate) fn billing(self) -> bool {
        self.optional_configuration() == Some(OptionalConfiguration::Billing)
    }

    pub(crate) fn github(self) -> bool {
        self.optional_configuration() == Some(OptionalConfiguration::GitHub)
    }

    pub(crate) fn optional_configuration(self) -> Option<OptionalConfiguration> {
        match self {
            Self::VerifyPreviewSignIn => Some(OptionalConfiguration::PreviewSignIn),
            Self::ConnectGitHub
            | Self::StartGitHubSignIn
            | Self::VerifyGitHubSignIn
            | Self::DisconnectGitHub
            | Self::CompleteGitHubInstallation
            | Self::DisconnectGitHubInstallation
            | Self::ReceiveGitHubWebhook
            | Self::ListInstallations
            | Self::InstallGitHubApp
            | Self::ListRepositories => Some(OptionalConfiguration::GitHub),
            Self::GetBilling
            | Self::StartCheckout
            | Self::OpenBillingPortal
            | Self::ReceiveBillingWebhook => Some(OptionalConfiguration::Billing),
            _ => None,
        }
    }
    /// Bearer-authenticated publication upload requests, handled outside JSON dispatch.
    pub(crate) fn upload(self) -> bool {
        matches!(
            self,
            Self::UploadPublication | Self::UploadPublicationBlob | Self::CompletePublicationUpload
        )
    }

    pub(crate) fn anonymous_read(self) -> bool {
        matches!(
            self,
            Self::GetHealth
                | Self::GetConfiguration
                | Self::GetProject
                | Self::GetProjectBySlug
                | Self::GetPublication
                | Self::ListScreens
                | Self::ListBranches
                | Self::ListPullRequests
                | Self::ListPublications
                | Self::ListHistory
                | Self::GetBuild
                | Self::ListBuildLog
                | Self::GetShareLink
        )
    }

    pub(crate) fn implemented(self) -> bool {
        self.optional_configuration().is_some()
            || matches!(
                self,
                Self::GetHealth
                    | Self::GetConfiguration
                    | Self::UploadPublication
                    | Self::UploadPublicationBlob
                    | Self::CompletePublicationUpload
                    | Self::IssueCatalogueGrant
                    | Self::GetSession
                    | Self::SignOut
                    | Self::RotateSession
                    | Self::SendMagicLink
                    | Self::IssueDesktopGrant
                    | Self::ExchangeDesktopGrant
                    | Self::ListWorkspaces
                    | Self::CreateWorkspace
                    | Self::SuggestWorkspaceSlug
                    | Self::GetWorkspace
                    | Self::GetWorkspaceBySlug
                    | Self::UpdateWorkspace
                    | Self::DeleteWorkspace
                    | Self::ListMembers
                    | Self::InviteMember
                    | Self::UpdateMember
                    | Self::RemoveMember
                    | Self::ListProjects
                    | Self::CreateProject
                    | Self::SuggestProjectSlug
                    | Self::ListBranches
                    | Self::ListPullRequests
                    | Self::ListPublications
                    | Self::RequestBuild
                    | Self::CancelBuild
                    | Self::ListHistory
                    | Self::GetBuild
                    | Self::ListBuildLog
                    | Self::GetPublication
                    | Self::ListScreens
                    | Self::GetShareLink
                    | Self::GetProject
                    | Self::GetProjectBySlug
                    | Self::UpdateProject
                    | Self::DeleteProject
                    | Self::ListTokens
                    | Self::CreateToken
                    | Self::RevokeToken
                    | Self::ListProjectGrants
                    | Self::CreateProjectGrant
                    | Self::UpdateProjectGrant
                    | Self::RemoveProjectGrant
                    | Self::VerifyMagicLink
                    | Self::UpdateAccount
                    | Self::AcceptInvitation
            )
    }

    pub(crate) fn body_limit(self) -> usize {
        if matches!(
            self,
            Self::ReceiveGitHubWebhook | Self::ReceiveBillingWebhook
        ) {
            2 * 1024 * 1024
        } else {
            16 * 1024
        }
    }

    pub(crate) fn required_single_headers(self) -> &'static [&'static str] {
        match self {
            Self::ReceiveGitHubWebhook => {
                &["x-github-delivery", "x-github-event", "x-hub-signature-256"]
            }
            Self::ReceiveBillingWebhook => &["stripe-signature"],
            _ => &[],
        }
    }
}
