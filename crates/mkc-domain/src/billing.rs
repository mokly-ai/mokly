//! Typed plan catalogue and plan-derived billing values.

use std::collections::BTreeSet;
use std::iter::once;

use crate::values::{Plan, Role, SeatKind, Visibility};

/// Stripe product metadata key carrying Mokly's stable product lookup key.
pub const PRODUCT_LOOKUP_KEY_METADATA: &str = "mokly_lookup_key";

/// Stripe price metadata key carrying the catalogue seat kind.
pub const PRICE_SEAT_KIND_METADATA: &str = "mokly_seat_kind";

/// Stripe's tax treatment for a price.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TaxBehavior {
    /// Tax is added to the catalogue amount.
    Exclusive,
    /// Tax is included in the catalogue amount.
    Inclusive,
    /// The Stripe account default determines tax treatment.
    Unspecified,
}

impl TaxBehavior {
    /// Stable Stripe API spelling.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Exclusive => "exclusive",
            Self::Inclusive => "inclusive",
            Self::Unspecified => "unspecified",
        }
    }
}

/// Stable Stripe identity for one paid Mokly product.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct ProductIdentity {
    /// Plan represented by the Stripe product.
    pub plan: Plan,
    /// Value stored in [`PRODUCT_LOOKUP_KEY_METADATA`].
    pub lookup_key: &'static str,
    /// Customer-facing Stripe product name.
    pub name: &'static str,
}

/// Monthly price for one licensed seat of a specific kind.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SeatPrice {
    /// Role-derived seat category.
    pub kind: SeatKind,
    /// Tax-exclusive monthly unit amount in the catalogue currency.
    pub unit_amount_cents: u32,
    /// Stable Stripe price lookup key.
    pub lookup_key: &'static str,
    /// Operator-facing Stripe price nickname.
    pub nickname: &'static str,
    /// Tax treatment applied by Stripe Checkout.
    pub tax_behavior: TaxBehavior,
}

/// Product catalogue values shared by plan enforcement and billing providers.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Catalogue {
    /// Paid Stripe product identity.
    pub product: ProductIdentity,
    /// Lowercase ISO currency code.
    pub currency: &'static str,
    /// Recurring billing interval.
    pub interval: &'static str,
    /// Stripe recurring-price usage type.
    pub usage_type: &'static str,
    /// One-time Team trial length.
    pub trial_days: u32,
    /// Stripe API version sent by provider requests.
    pub stripe_version: &'static str,
    /// Monthly licensed seat prices.
    pub seats: [SeatPrice; 2],
}

/// The verified Mokly Cloud plan and seat catalogue.
pub const CATALOGUE: Catalogue = Catalogue {
    product: ProductIdentity {
        plan: Plan::Team,
        lookup_key: "mokly_team",
        name: "Mokly Team",
    },
    currency: "usd",
    interval: "month",
    usage_type: "licensed",
    trial_days: 7,
    stripe_version: "2026-08-26.dahlia",
    seats: [
        SeatPrice {
            kind: SeatKind::Editor,
            unit_amount_cents: 2_000,
            lookup_key: "mokly_team_editor_usd_month",
            nickname: "Editor seat",
            tax_behavior: TaxBehavior::Exclusive,
        },
        SeatPrice {
            kind: SeatKind::Collaborator,
            unit_amount_cents: 500,
            lookup_key: "mokly_team_collaborator_usd_month",
            nickname: "Collaborator seat",
            tax_behavior: TaxBehavior::Exclusive,
        },
    ],
};

/// One violation of the repository-owned Stripe catalogue identity.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum IdentityViolation {
    /// A lookup key does not match `^mokly_[a-z0-9_]+$`.
    InvalidLookupKey {
        /// Invalid product or price lookup key.
        key: &'static str,
    },
    /// One lookup key identifies more than one catalogue object.
    DuplicateLookupKey {
        /// Repeated product or price lookup key.
        key: &'static str,
    },
    /// The paid Stripe product represents a plan other than Team.
    ProductPlanNotTeam {
        /// Plan incorrectly assigned to the paid product.
        plan: Plan,
    },
    /// The Stripe product name is empty.
    EmptyProductName,
    /// A Stripe price nickname is empty.
    EmptyPriceNickname {
        /// Seat whose price has no nickname.
        kind: SeatKind,
    },
}

impl Catalogue {
    /// Return every deterministic identity-contract violation.
    pub fn identity_violations(&self) -> Vec<IdentityViolation> {
        let mut violations = Vec::new();
        if self.product.plan != Plan::Team {
            violations.push(IdentityViolation::ProductPlanNotTeam {
                plan: self.product.plan,
            });
        }
        if self.product.name.is_empty() {
            violations.push(IdentityViolation::EmptyProductName);
        }

        let mut keys = BTreeSet::new();
        for key in
            once(self.product.lookup_key).chain(self.seats.iter().map(|seat| seat.lookup_key))
        {
            if !valid_lookup_key(key) {
                violations.push(IdentityViolation::InvalidLookupKey { key });
            }
            if !keys.insert(key) {
                violations.push(IdentityViolation::DuplicateLookupKey { key });
            }
        }
        for seat in self.seats {
            if seat.nickname.is_empty() {
                violations.push(IdentityViolation::EmptyPriceNickname { kind: seat.kind });
            }
        }
        violations
    }
}

fn valid_lookup_key(value: &str) -> bool {
    value.strip_prefix("mokly_").is_some_and(|suffix| {
        !suffix.is_empty()
            && suffix
                .bytes()
                .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'_')
    })
}

impl SeatKind {
    /// Derive the billable seat kind from the user's strongest role.
    pub fn of_role(role: Role) -> Self {
        match role {
            Role::Owner | Role::Admin | Role::Member => Self::Editor,
            Role::Reviewer => Self::Collaborator,
        }
    }
}

impl Plan {
    /// Whether this plan permits publishing a project with this visibility.
    pub fn allows_publication(self, visibility: Visibility) -> bool {
        visibility == Visibility::Public || self.allows_private_projects()
    }

    /// Whether this plan permits private projects and publications.
    pub fn allows_private_projects(self) -> bool {
        matches!(self, Self::Team)
    }
}

#[cfg(test)]
#[path = "_tests_/billing_tests.rs"]
mod billing_tests;
