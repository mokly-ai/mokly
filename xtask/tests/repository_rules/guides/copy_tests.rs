//! Guide prose follows the reader-facing copy rules.

use regex::Regex;

use super::pages::{GUIDES, without_fenced_code};

const NEVER: [&str; 3] = ["not supported", "coming soon", "roadmap"];

#[test]
fn guide_prose_follows_the_reader_facing_copy_exclusions() {
    let comment = Regex::new(r"<!--[\s\S]*?-->").unwrap();
    let code = Regex::new(r"`[^`]*`").unwrap();
    let whitespace = Regex::new(r"\s+").unwrap();
    for guide in GUIDES.iter() {
        let prose = without_fenced_code(&guide.body);
        let prose = comment.replace_all(&prose, " ");
        let prose = code.replace_all(&prose, " ");
        let prose = whitespace.replace_all(&prose, " ");
        for phrase in NEVER {
            let pattern = Regex::new(&format!("(?i){phrase}")).unwrap();
            assert!(!pattern.is_match(&prose), "{}: {phrase}", guide.id);
        }
    }
}

#[test]
fn packaged_guides_omit_repository_only_paths_and_internal_implementation_names() {
    for guide in GUIDES.iter() {
        for forbidden in [
            r"examples/",
            r"BROWSERSLIST_IGNORE_OLD_DATA",
            r"\bencodeUrlPath\b",
        ] {
            let pattern = Regex::new(forbidden).unwrap();
            assert!(!pattern.is_match(&guide.body), "{}: {forbidden}", guide.id);
        }
    }
}
