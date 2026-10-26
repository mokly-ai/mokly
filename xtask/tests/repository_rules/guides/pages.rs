//! The guide pages in reading order, with their checked front matter.

use std::fs;
use std::path::{Path, PathBuf};
use std::sync::LazyLock;

use regex::Regex;

use crate::support::repository_root;

/// The guide sections in reading order.
pub(crate) const GUIDE_SECTIONS: [&str; 5] = ["start", "authoring", "catalogue", "ci", "cli"];

/// The front matter fields of one guide.
pub(crate) struct GuideFrontmatter {
    /// The one-line summary.
    pub(crate) description: String,
    /// The position within the section.
    pub(crate) order: u64,
    /// The declared section.
    pub(crate) section: String,
    /// The page title.
    pub(crate) title: String,
}

/// One guide page.
pub(crate) struct GuidePage {
    /// The Markdown after the front matter.
    pub(crate) body: String,
    /// The parsed front matter.
    pub(crate) frontmatter: GuideFrontmatter,
    /// The front matter lines between the two `---` lines.
    pub(crate) frontmatter_source: String,
    /// `section/slug`.
    pub(crate) id: String,
    /// The file name without `.md`.
    pub(crate) slug: String,
}

/// Every guide page, sorted by section, order, and slug.
pub(crate) static GUIDES: LazyLock<Vec<GuidePage>> = LazyLock::new(load_guides);

/// The guide directory.
pub(crate) fn guides_root() -> PathBuf {
    repository_root().join("docs").join("guides")
}

/// The source without the lines of fenced code blocks and their fences.
pub(crate) fn without_fenced_code(source: &str) -> String {
    let mut kept = Vec::new();
    let mut fence = false;
    for line in source.split('\n') {
        if line.starts_with("```") {
            fence = !fence;
            continue;
        }
        if !fence {
            kept.push(line);
        }
    }
    kept.join("\n")
}

fn load_guides() -> Vec<GuidePage> {
    let mut guides = Vec::new();
    for section in GUIDE_SECTIONS {
        let directory = guides_root().join(section);
        for entry in fs::read_dir(&directory).unwrap() {
            let entry = entry.unwrap();
            let name = entry.file_name().into_string().unwrap();
            if entry.file_type().unwrap().is_file() && name.ends_with(".md") {
                guides.push(parse_guide(&entry.path(), section));
            }
        }
    }
    let position = |section: &str| GUIDE_SECTIONS.iter().position(|known| *known == section);
    guides.sort_by(|left, right| {
        position(&left.frontmatter.section)
            .cmp(&position(&right.frontmatter.section))
            .then(left.frontmatter.order.cmp(&right.frontmatter.order))
            .then_with(|| left.slug.cmp(&right.slug))
    });
    guides
}

fn parse_guide(filename: &Path, section: &str) -> GuidePage {
    let shown = filename.display();
    let source = fs::read_to_string(filename).unwrap();
    let boundaries = Regex::new(r"^---\n([\s\S]*?)\n---\n([\s\S]*)$").unwrap();
    let parts = boundaries
        .captures(&source)
        .unwrap_or_else(|| panic!("{shown} has invalid frontmatter boundaries"));
    let frontmatter_source = parts[1].to_owned();
    let lines: Vec<&str> = frontmatter_source.split('\n').collect();
    let string_field = |index: usize, key: &str| -> String {
        let field = Regex::new(&format!(r#"^{key}: ("(?:[^"\\]|\\.)*")$"#)).unwrap();
        let quoted = field
            .captures(lines.get(index).copied().unwrap_or_default())
            .unwrap_or_else(|| panic!("{shown} has invalid {key}"));
        serde_json::from_str(&quoted[1]).unwrap_or_else(|_| panic!("{shown} has invalid {key}"))
    };
    let order = Regex::new(r"^order: ([1-9][0-9]*)$")
        .unwrap()
        .captures(lines.get(3).copied().unwrap_or_default())
        .map(|order| order[1].to_owned());
    let Some(order) = order.filter(|_| lines.len() == 4) else {
        panic!("{shown} has invalid frontmatter fields");
    };
    let declared_section = string_field(2, "section");
    assert!(
        GUIDE_SECTIONS.contains(&declared_section.as_str()),
        "{shown} has unknown section {declared_section}"
    );
    let slug = filename
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap()
        .to_owned();
    GuidePage {
        body: parts[2].to_owned(),
        frontmatter: GuideFrontmatter {
            description: string_field(1, "description"),
            order: order.parse().unwrap_or(u64::MAX),
            section: declared_section,
            title: string_field(0, "title"),
        },
        frontmatter_source,
        id: format!("{section}/{slug}"),
        slug,
    }
}
