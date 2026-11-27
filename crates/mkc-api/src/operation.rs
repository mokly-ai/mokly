//! Typed operation identifiers shared by the OpenAPI contract and dispatch.

use serde::Deserialize;
use serde::de::value::{Error, StrDeserializer};

/// Declare the gate and its complete inventory from one list.
macro_rules! optional_configurations {
    ($($(#[$doc:meta])* $kind:ident),+ $(,)?) => {
        /// Runtime configuration required by groups of optional operations.
        #[derive(Clone, Copy, Debug, PartialEq, Eq)]
        pub(crate) enum OptionalConfiguration {
            $($(#[$doc])* $kind),+
        }

        impl OptionalConfiguration {
            /// Every configuration that the public answer must cover.
            pub(crate) const ALL: &[Self] = &[$(Self::$kind),+];
        }
    };
}

optional_configurations!(
    /// Configured shared preview account.
    PreviewSignIn,
    /// Configured GitHub integration.
    GitHub,
    /// Configured billing service.
    Billing,
);

#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
pub(crate) enum Operation {
    #[serde(rename = "getHealth")]
    GetHealth,
    /// Read the public API configuration.
    #[serde(rename = "getConfiguration")]
    GetConfiguration,
    #[serde(rename = "uploadPublication")]
    UploadPublication,
    #[serde(rename = "uploadPublicationBlob")]
    UploadPublicationBlob,
    #[serde(rename = "completePublicationUpload")]
    CompletePublicationUpload,
    #[serde(rename = "issueCatalogueGrant")]
    IssueCatalogueGrant,
    #[serde(rename = "getSession")]
    GetSession,
    #[serde(rename = "signOut")]
    SignOut,
    #[serde(rename = "rotateSession")]
    RotateSession,
    #[serde(rename = "sendMagicLink")]
    SendMagicLink,
    #[serde(rename = "verifyPreviewSignIn")]
    VerifyPreviewSignIn,
    #[serde(rename = "issueDesktopGrant")]
    IssueDesktopGrant,
    #[serde(rename = "exchangeDesktopGrant")]
    ExchangeDesktopGrant,
    #[serde(rename = "connectGitHub")]
    ConnectGitHub,
    #[serde(rename = "startGitHubSignIn")]
    StartGitHubSignIn,
    #[serde(rename = "verifyGitHubSignIn")]
    VerifyGitHubSignIn,
    #[serde(rename = "disconnectGitHub")]
    DisconnectGitHub,
    #[serde(rename = "completeGitHubInstallation")]
    CompleteGitHubInstallation,
    #[serde(rename = "disconnectGitHubInstallation")]
    DisconnectGitHubInstallation,
    #[serde(rename = "receiveGitHubWebhook")]
    ReceiveGitHubWebhook,
    #[serde(rename = "listInstallations")]
    ListInstallations,
    #[serde(rename = "installGitHubApp")]
    InstallGitHubApp,
    #[serde(rename = "listRepositories")]
    ListRepositories,
    #[serde(rename = "listWorkspaces")]
    ListWorkspaces,
    #[serde(rename = "createWorkspace")]
    CreateWorkspace,
    #[serde(rename = "suggestWorkspaceSlug")]
    SuggestWorkspaceSlug,
    #[serde(rename = "getWorkspace")]
    GetWorkspace,
    #[serde(rename = "getWorkspaceBySlug")]
    GetWorkspaceBySlug,
    #[serde(rename = "updateWorkspace")]
    UpdateWorkspace,
    #[serde(rename = "deleteWorkspace")]
    DeleteWorkspace,
    #[serde(rename = "listMembers")]
    ListMembers,
    #[serde(rename = "inviteMember")]
    InviteMember,
    #[serde(rename = "updateMember")]
    UpdateMember,
    #[serde(rename = "removeMember")]
    RemoveMember,
    #[serde(rename = "listProjects")]
    ListProjects,
    #[serde(rename = "createProject")]
    CreateProject,
    #[serde(rename = "suggestProjectSlug")]
    SuggestProjectSlug,
    #[serde(rename = "getProject")]
    GetProject,
    #[serde(rename = "getProjectBySlug")]
    GetProjectBySlug,
    #[serde(rename = "updateProject")]
    UpdateProject,
    #[serde(rename = "deleteProject")]
    DeleteProject,
    #[serde(rename = "listTokens")]
    ListTokens,
    #[serde(rename = "createToken")]
    CreateToken,
    #[serde(rename = "revokeToken")]
    RevokeToken,
    #[serde(rename = "listProjectGrants")]
    ListProjectGrants,
    #[serde(rename = "createProjectGrant")]
    CreateProjectGrant,
    #[serde(rename = "updateProjectGrant")]
    UpdateProjectGrant,
    #[serde(rename = "removeProjectGrant")]
    RemoveProjectGrant,
    #[serde(rename = "listBranches")]
    ListBranches,
    #[serde(rename = "listPullRequests")]
    ListPullRequests,
    #[serde(rename = "listPublications")]
    ListPublications,
    #[serde(rename = "getPublication")]
    GetPublication,
    #[serde(rename = "listScreens")]
    ListScreens,
    #[serde(rename = "getShareLink")]
    GetShareLink,
    #[serde(rename = "listHistory")]
    ListHistory,
    #[serde(rename = "getBuild")]
    GetBuild,
    #[serde(rename = "listBuildLog")]
    ListBuildLog,
    #[serde(rename = "requestBuild")]
    RequestBuild,
    #[serde(rename = "cancelBuild")]
    CancelBuild,
    #[serde(rename = "listThreads")]
    ListThreads,
    #[serde(rename = "createThread")]
    CreateThread,
    #[serde(rename = "getThread")]
    GetThread,
    #[serde(rename = "resolveThread")]
    ResolveThread,
    #[serde(rename = "replyToThread")]
    ReplyToThread,
    #[serde(rename = "editComment")]
    EditComment,
    #[serde(rename = "deleteComment")]
    DeleteComment,
    #[serde(rename = "getReview")]
    GetReview,
    #[serde(rename = "approvePublication")]
    ApprovePublication,
    #[serde(rename = "withdrawApproval")]
    WithdrawApproval,
    #[serde(rename = "listReviewAudit")]
    ListReviewAudit,
    #[serde(rename = "verifyMagicLink")]
    VerifyMagicLink,
    #[serde(rename = "updateAccount")]
    UpdateAccount,
    #[serde(rename = "acceptInvitation")]
    AcceptInvitation,
    #[serde(rename = "getBilling")]
    GetBilling,
    #[serde(rename = "startCheckout")]
    StartCheckout,
    #[serde(rename = "openBillingPortal")]
    OpenBillingPortal,
    #[serde(rename = "receiveBillingWebhook")]
    ReceiveBillingWebhook,
}

impl Operation {
    /// Decode the operation ID with the same names used by the contract.
    pub(crate) fn parse(id: &str) -> Result<Self, Error> {
        Self::deserialize(StrDeserializer::new(id))
    }
}
