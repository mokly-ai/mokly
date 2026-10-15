//! Isolated catalogue behavior fixtures.

#[path = "support/fixtures.rs"]
mod fixtures;

#[test]
fn derived_path() {
    fixtures::check("derived-path");
}

#[test]
fn prefix_transparent() {
    fixtures::check("prefix-transparent");
}

#[test]
fn declared_path() {
    fixtures::check("declared-path");
}

#[test]
fn index_screen() {
    fixtures::check("index-screen");
}

#[test]
fn index_document() {
    fixtures::check("index-document");
}

#[test]
fn document_first_dot() {
    fixtures::check("document-first-dot");
}

#[test]
fn root_index() {
    fixtures::check("root-index");
}

#[test]
fn document_root_index() {
    fixtures::check("document-root-index");
}

#[test]
fn duplicate_index() {
    fixtures::check("duplicate-index");
}

#[test]
fn duplicate_path() {
    fixtures::check("duplicate-path");
}

#[test]
fn case_collision() {
    fixtures::check("case-collision");
}

#[test]
fn folder_case_collision() {
    fixtures::check("folder-case-collision");
}

#[test]
fn leaf_folder_collision() {
    fixtures::check("leaf-folder-collision");
}

#[test]
fn invalid_file_segment() {
    fixtures::check("invalid-file-segment");
}

#[test]
fn invalid_directory_segment() {
    fixtures::check("invalid-directory-segment");
}

#[test]
fn device_segment() {
    fixtures::check("device-segment");
}

#[test]
fn reserved_prefix() {
    fixtures::check("reserved-prefix");
}

#[test]
fn declared_invalid() {
    fixtures::check("declared-invalid");
}

#[test]
fn variants() {
    fixtures::check("variants");
}

#[test]
fn duplicate_variant() {
    fixtures::check("duplicate-variant");
}

#[test]
fn nested_variant() {
    fixtures::check("nested-variant");
}

#[test]
fn unknown_variant_field() {
    fixtures::check("unknown-variant-field");
}

#[test]
fn missing_variant_slug() {
    fixtures::check("missing-variant-slug");
}

#[test]
fn invalid_variant_slug() {
    fixtures::check("invalid-variant-slug");
}

#[test]
fn move_own() {
    fixtures::check("move-own");
}

#[test]
fn move_current() {
    fixtures::check("move-current");
}

#[test]
fn duplicate_move() {
    fixtures::check("duplicate-move");
}

#[test]
fn invalid_move() {
    fixtures::check("invalid-move");
}

#[test]
fn moved_link() {
    fixtures::check("moved-link");
}

#[test]
fn unknown_link() {
    fixtures::check("unknown-link");
}

#[test]
fn relative_flow() {
    fixtures::check("relative-flow");
}

#[test]
fn reciprocal_flow() {
    fixtures::check("reciprocal-flow");
}

#[test]
fn folder_exclusion() {
    fixtures::check("folder-exclusion");
}

#[test]
fn folder_overlap() {
    fixtures::check("folder-overlap");
}

#[test]
fn file_overlap() {
    fixtures::check("file-overlap");
}

#[test]
fn folder_unknown_child() {
    fixtures::check("folder-unknown-child");
}

#[test]
fn folder_unused() {
    fixtures::check("folder-unused");
}

#[test]
fn folder_top_title() {
    fixtures::check("folder-top-title");
}

#[test]
fn folder_title_index_screen() {
    fixtures::check("folder-title-index-screen");
}

#[test]
fn duplicate_folder() {
    fixtures::check("duplicate-folder");
}

#[test]
fn unknown_config() {
    fixtures::check("unknown-config");
}

#[test]
fn missing_root() {
    fixtures::check("missing-root");
}

#[test]
fn empty_root() {
    fixtures::check("empty-root");
}

#[test]
fn duplicate_glob() {
    fixtures::check("duplicate-glob");
}

#[test]
fn unsafe_expanded_glob() {
    fixtures::check("unsafe-expanded-glob");
}
