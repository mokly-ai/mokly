//! The native test scope: the Mokly Rust tests that the native suite leaves
//! out, because their behaviour cannot differ by platform.
//!
//! The native suite repeats the Rust tests on macOS and Windows to find
//! platform defects. The Repository suite still runs every test on Linux. The
//! list below excludes; it does not include. A new test therefore runs on
//! every platform until someone adds it here.
//!
//! A test stays on every platform when it touches paths, links, file names or
//! their case, line endings, processes and signals, file watching, sockets and
//! ports, stack depth, temporary folders, Git subprocesses, the sidecar Node
//! process, or locks. Every test of `mokly-platform`, `mokly-git`,
//! `mokly-sidecar`, `mokly-watch`, `mokly-catalogue`, `mokly-static`, and
//! `mokly-server` stays. A test leaves only when it checks pure logic, and
//! its fixtures use Git, temporary folders, or the sidecar only to produce
//! the inputs that kept tests cover on every platform. When in doubt, keep
//! the test.

use std::collections::BTreeSet;

use self::Neutral::{Binary, Module};
use super::rust_targets::TestUnit;

/// The nextest binary ID of the `mokly-render` integration test binary.
const RENDER: &str = "mokly-render::integration_tests";

/// Tests that the native scope leaves out.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum Neutral {
    /// Every test of one test binary, by its nextest binary ID.
    Binary(&'static str),
    /// Every test of one module of a test binary: the binary ID and the
    /// module path under the crate root of the binary.
    Module(&'static str, &'static str),
}

/// CSS attribution and rule ownership. The tests decide which component owns
/// a matched rule. Rule matching and the ownership proof read parsed CSS and
/// rendered trees in memory.
const CSS_ATTRIBUTION: &[Neutral] = &[
    Binary("mokly-cli::changes_containment_tests"),
    Binary("mokly-cli::changes_declared_ancestor_tests"),
    Binary("mokly-cli::changes_nested_proof_tests"),
    Binary("mokly-cli::changes_registry_ownership_tests"),
    Binary("mokly-cli::changes_supplier_tests"),
    Binary("mokly-compare::css_engine_tests"),
    Binary("mokly-compare::inline_engine_tests"),
    Binary("mokly-css::match_proof_tests"),
    Module(RENDER, "integration::base_styles_tests"),
    Module(RENDER, "integration::containment_tests"),
    Module(RENDER, "integration::owned_catalogue_tests"),
    Module(RENDER, "integration::owned_rule_tests"),
    Module(RENDER, "integration::ownership_tests"),
    Module(RENDER, "integration::registry_matrix_tests"),
    Module(RENDER, "integration::supplier_containment_tests"),
];

/// Changes classification. The tests decide whether an entry, a view, or a
/// usage changed from two catalogue models. The fixture repositories turn
/// off line-ending conversion, and no test checks a path, a file name, or its
/// case.
const CHANGES_CLASSIFICATION: &[Neutral] = &[
    Binary("mokly-cli::changes_plaintext_root_tests"),
    Binary("mokly-cli::changes_view_sides_tests"),
    Binary("mokly-compare::affected_donor_tests"),
    Binary("mokly-compare::byte_equal_engine_tests"),
    Binary("mokly-compare::impact_engine_tests"),
    Binary("mokly-compare::instance_engine_tests"),
    Binary("mokly-compare::metadata_engine_tests"),
    Binary("mokly-compare::page_similarity_tests"),
];

/// Scale proofs. The tests count operations over large generated catalogues
/// and assert no elapsed time.
const SCALE_COUNTS: &[Neutral] = &[Binary("mokly-compare::scale_engine_tests")];

/// Authoring rules of the catalogue model: component declarations, control
/// bounds, slot order, warnings, and design contracts.
const AUTHORING_RULES: &[Neutral] = &[
    Binary("mokly-cli::design_behaviour_tests"),
    Binary("mokly-cli::unsafe_html_warning_tests"),
    Module(RENDER, "integration::declaration_tests"),
    Module(RENDER, "integration::review_validation_tests"),
    Module(RENDER, "integration::slot_order_tests"),
];

/// HTML parsing, repair, and composition of rendered documents in memory.
const HTML_COMPOSITION: &[Neutral] = &[
    Binary("mokly-graph::collection_tests"),
    Binary("mokly-graph::final_tree_tests"),
    Binary("mokly-graph::html_repair_tests"),
    Binary("mokly-graph::ignore_key_tests"),
    Binary("mokly-graph::plaintext_tests"),
];

/// Every group of tests that the native scope leaves out.
const GROUPS: [&[Neutral]; 5] = [
    CSS_ATTRIBUTION,
    CHANGES_CLASSIFICATION,
    SCALE_COUNTS,
    AUTHORING_RULES,
    HTML_COMPOSITION,
];

/// The Rust tests that one suite runs.
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(crate) enum TestScope {
    /// Every Mokly Rust test.
    Complete,
    /// Every Mokly Rust test except the platform-neutral tests of this module.
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
        })
        .collect();
    format!("not ({})", parts.join(" | "))
}
