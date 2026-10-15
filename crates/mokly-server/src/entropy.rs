//! Process secrets and deployment identities from an injected random boundary.

use mokly_model::material::digest;

/// Random process identity source.
#[cfg_attr(test, unimock::unimock(api = EntropyMock))]
pub trait Entropy: Send + Sync {
    /// Return an unpredictable 256-bit lowercase hex value.
    fn secret(&self) -> String;
}

/// Operating-system seeded thread RNG.
pub struct RandomEntropy;
impl Entropy for RandomEntropy {
    fn secret(&self) -> String {
        digest(&rand::random::<[u8; 32]>())
    }
}
