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
    /// One test of a test binary: the binary ID and the full test name.
    Test(&'static str, &'static str),
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

/// Stress tests. Each test builds a tree of at least 10,000 levels, at least
/// 10,000 files or entries, or tens of megabytes. The Repository suite runs
/// them on Linux.
const STRESS: &[Neutral] = &[
    Test(
        "mokly-catalogue::nesting_depth_tests",
        "front_matter_of_any_depth_reaches_the_search_cap",
    ),
    Binary("mokly-compare::deep_tree_tests"),
    Binary("mokly-compare::large_sources_tests"),
    Test(
        "mokly-css::nesting_depth_tests",
        "mokly_reference_scanner_reaches_the_search_cap",
    ),
    Binary("mokly-graph::deep_tree_tests"),
    Binary("mokly-html::deep_tree_tests"),
    Test(
        "mokly-catalogue",
        "yaml::yaml_depth_tests::deep_input_stops_at_the_limit",
    ),
    Test(
        "mokly-compare",
        "inline_styles::inline_styles_tests::deep_head_styles_preserve_order_and_do_not_leak_head_state_to_siblings",
    ),
    Test(
        "mokly-compare",
        "instance_impact::instance_impact_tests::deep_slot_search_preserves_scope_merge_order",
    ),
    Test(
        "mokly-compare",
        "matching_tree::matching_tree_tests::deep_regions_and_elements_use_a_heap_walk_and_restore_sibling_scope",
    ),
    Test(
        "mokly-compare",
        "material::material_tests::deep_values_compare_hash_and_drop_without_using_tree_depth_as_stack_depth",
    ),
    Test(
        "mokly-compare",
        "owned_style_instances::owned_style_instances_tests::deep_nested_instances_retain_only_the_matched_chain",
    ),
    Test(
        "mokly-compare",
        "owned_styles::owned_styles_tests::deep_styles_map_owners_deduplicate_rules_and_skip_inert_subtrees",
    ),
    Test(
        "mokly-compare",
        "workspace_patterns_tests::many_and_deeply_nested_groups_need_no_expansion_list",
    ),
    Test(
        "mokly-css",
        "containment::containment_tests::final_deep_path_owner_releases_on_an_ordinary_stack",
    ),
    Test(
        "mokly-css",
        "deep_scanner_tests::boundaries_strip_only_top_level_html_comments_around_deep_blocks",
    ),
    Test(
        "mokly-css",
        "deep_scanner_tests::deep_grouping_rules_scope_the_innermost_class",
    ),
    Test(
        "mokly-css",
        "deep_scanner_tests::deep_nested_rules_and_wrappers_scope_every_local_name",
    ),
    Test(
        "mokly-css",
        "deep_scanner_tests::integrity_compares_the_innermost_function_argument",
    ),
    Test(
        "mokly-css",
        "deep_scanner_tests::module_checks_find_a_deep_value_rule_after_custom_property_blocks",
    ),
    Test(
        "mokly-css",
        "deep_scanner_tests::normalization_keeps_separators_inside_deep_blocks",
    ),
    Test(
        "mokly-css",
        "deep_scanner_tests::references_keep_ranges_and_import_order_inside_deep_functions",
    ),
    Test(
        "mokly-css",
        "has_depth_tests::very_deep_pages_keep_relational_evidence_and_match_other_selectors",
    ),
    Test(
        "mokly-graph",
        "document_codec::document_codec_tests::capture_and_restore_are_iterative_and_keep_authored_owner_attributes_untrusted",
    ),
    Module("mokly-html", "deep_context_tests"),
    Test(
        "mokly-model",
        "catalogue_tree::catalogue_tree_tests::deep_navigation_clones_formats_and_drops_on_an_ordinary_thread",
    ),
    Test(
        "mokly-model",
        "output::artifact::artifact_tests::marker_writer_has_no_publication_file_count_ceiling",
    ),
    Test(
        "mokly-model",
        "output::artifact::artifact_tests::marker_writer_rejects_a_marker_above_the_regular_file_limit",
    ),
    Test(
        "mokly-render",
        "stylesheet_record::stylesheet_chain_drop_tests::finding_8_releasing_a_long_context_chain_uses_bounded_stack_space",
    ),
    Test(
        "mokly-render",
        "stylesheets::stylesheet_walk_tests::a_deep_import_chain_keeps_first_stylesheet_encounter_and_stops_cycles",
    ),
    Test(
        "mokly-static",
        "assembly_tests::rejects_a_current_index_above_the_output_file_limit",
    ),
];

/// Every group of tests that the native scope leaves out.
const GROUPS: [&[Neutral]; 6] = [
    CSS_ATTRIBUTION,
    CHANGES_CLASSIFICATION,
    SCALE_COUNTS,
    AUTHORING_RULES,
    HTML_COMPOSITION,
    STRESS,
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
