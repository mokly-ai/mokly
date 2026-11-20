//! Byte-exact Postmark template artifacts available to the email adapter.

/// The two transactional messages authored in the mockup catalogue.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Kind {
    /// One-time sign-in link.
    SignIn,
    /// Organization invitation.
    Invitation,
}

impl Kind {
    /// Alias of this template on both stable Postmark servers.
    pub const fn alias(self) -> &'static str {
        match self {
            Self::SignIn => "mokly-sign-in",
            Self::Invitation => "mokly-invitation",
        }
    }
}

/// A committed template's three rendered source parts.
pub struct Template {
    /// Subject text, including the generated trailing newline.
    pub subject: &'static str,
    /// Complete standalone HTML document.
    pub html: &'static str,
    /// Plain-text alternative.
    pub text: &'static str,
}

/// Read the committed source for one transactional message.
pub fn get(kind: Kind) -> Template {
    match kind {
        Kind::SignIn => Template {
            subject: include_str!("../templates/sign-in.subject.txt"),
            html: include_str!("../templates/sign-in.html"),
            text: include_str!("../templates/sign-in.txt"),
        },
        Kind::Invitation => Template {
            subject: include_str!("../templates/invitation.subject.txt"),
            html: include_str!("../templates/invitation.html"),
            text: include_str!("../templates/invitation.txt"),
        },
    }
}
