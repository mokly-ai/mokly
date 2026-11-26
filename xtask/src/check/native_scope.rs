//! The native test scope: the Mokly Rust tests that the native suite leaves
//! out, because their behaviour cannot differ by platform or because they are
//! stress tests.
//!
//! The native suite repeats the Rust tests on macOS and Windows to find
//! platform defects. The Repository suite still runs every test on Linux. The
//! list below excludes; it does not include. A new test therefore runs on
//! every platform until someone adds it here.
//!
//! A test that is not a stress test stays on every platform when it touches
//! paths, links, file names or their case, line endings, processes and
//! signals, file watching, sockets and ports, stack depth, temporary folders,
//! Git subprocesses, the sidecar Node process, or locks. Every other test of
//! `mokly-platform`, `mokly-git`, `mokly-sidecar`, `mokly-watch`,
//! `mokly-catalogue`, `mokly-static`, and `mokly-server` stays. A test that
//! is not a stress test leaves only when it checks pure logic, and
//! its fixtures use Git, temporary folders, or the sidecar only to produce
//! the inputs that kept tests cover on every platform. When in doubt, keep
//! the test.
//!
//! Stress tests are the one exception, in every crate: they run on Linux
//! only. A stress test builds an input far past authored sizes, a tree of at
//! least 10,000 levels, at least 10,000 files or entries, or tens of
//! megabytes, and proves that Mokly survives it. A stack overflow at such a
//! depth that only macOS or Windows has is then not caught.

use std::collections::BTreeSet;

use self::Neutral::{Binary, Module, Test};
use super::rust_targets::TestUnit;

/// Tests that the native scope leaves out.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Neutral {
    /// Every test of one test binary, by its nextest binary ID.
    Binary(&'static str),
    /// Every test of one module of a test binary: the binary ID and the
    /// module path under the crate root of the binary.
    Module(&'static str, &'static str),
    /// One test of a test binary: the binary ID and the full test name.
    Test(&'static str, &'static str),
}

mod neutral;
mod stress;

/// Every group of tests that the native scope leaves out.
const GROUPS: [&[Neutral]; 6] = [
    neutral::CSS_ATTRIBUTION,
    neutral::CHANGES_CLASSIFICATION,
    neutral::SCALE_COUNTS,
    neutral::AUTHORING_RULES,
    neutral::HTML_COMPOSITION,
    stress::STRESS,
];

/// The Rust tests that one suite runs.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum TestScope {
    /// Every Mokly Rust test.
    Complete,
    /// Every Mokly Rust test except the platform-neutral tests and the stress
    /// tests of this module.
    Native,
}

impl TestScope {
    /// The nextest arguments that leave the out-of-scope tests out.
    pub(super) fn nextest_args(self) -> Vec<String> {
        match self {
            Self::Complete => Vec::new(),
            Self::Native => vec!["-E".to_owned(), native_filterset()],
        }
    }

    /// Whether the scope runs no test of a unit whose targets belong to the
    /// given packages. Only a test binary can leave as a whole, and only when
    /// the binary of every package leaves.
    pub(super) fn leaves_out(self, unit: &TestUnit, packages: &BTreeSet<String>) -> bool {
        let TestUnit::Test(name) = unit else {
            return false;
        };
        self == Self::Native
            && !packages.is_empty()
            && packages.iter().all(|package| {
                let id = format!("{package}::{name}");
                neutral().any(|test| matches!(test, Binary(binary) if binary == id))
            })
    }
}

fn neutral() -> impl Iterator<Item = Neutral> {
    GROUPS.into_iter().flatten().copied()
}

/// The nextest filterset that matches every test outside the list.
fn native_filterset() -> String {
    let parts: Vec<String> = neutral()
        .map(|test| match test {
            Binary(id) => format!("binary_id(={id})"),
            Module(id, module) => format!("(binary_id(={id}) & test(/^{module}::/))"),
            Test(id, name) => format!("(binary_id(={id}) & test(={name}))"),
        })
        .collect();
    format!("not ({})", parts.join(" | "))
}
