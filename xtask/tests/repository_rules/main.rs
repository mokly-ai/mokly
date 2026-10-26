//! Repository file rules: the GitHub automation, the guides, the Markdown
//! links, the design palette, and the Rust package-version policy. Every test
//! reads files of the checked-out tree and needs no build output.

mod design;
mod guides;
mod markdown;
mod markdown_links_tests;
mod rust_package_version;
mod rust_package_version_tests;
mod support;
mod workflows;
