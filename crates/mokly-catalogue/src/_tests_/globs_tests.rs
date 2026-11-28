//! Grouped glob compilation and compatibility with expanded path checks.

use super::{GlobSyntax, compile};

#[test]
fn thirty_two_adjacent_groups_compile_to_one_matching_glob() {
    for (group, syntax) in [
        ("@(a|b)", GlobSyntax::Storybook),
        ("{a,b}", GlobSyntax::Posix),
    ] {
        let pattern = format!("{}.stories.tsx", group.repeat(32));
        let matcher = compile(&[pattern], syntax).unwrap();
        assert_eq!(matcher.len(), 1, "{group}");
        for text in ["ab".repeat(16), "b".repeat(32)] {
            assert!(matcher.is_match(format!("{text}.stories.tsx")), "{group}");
        }
        for text in ["a".repeat(31), format!("{}c", "a".repeat(31))] {
            assert!(!matcher.is_match(format!("{text}.stories.tsx")), "{group}");
        }
    }
}

#[test]
fn grouped_path_validation_agrees_with_expansion_on_small_patterns() {
    for (syntax, pattern, accepted) in [
        (GlobSyntax::Posix, "root/{a,{b,c}}/*.md", true),
        (GlobSyntax::Posix, "root/x{a,}y/*.md", true),
        (GlobSyntax::Posix, "{root,../root}/*.md", false),
        (GlobSyntax::Posix, "root/{a,}/x.md", false),
        (GlobSyntax::Posix, "root/{a/,b}/x.md", false),
        (GlobSyntax::Posix, "root/{.,a}{.,b}/x.md", false),
        (GlobSyntax::Posix, "root/{.,a}{x,.}/x.md", false),
        (GlobSyntax::Posix, "root/{.,a}{x,b}/x.md", true),
        (GlobSyntax::Posix, "{!a,b}/*.md", false),
        (GlobSyntax::Posix, "{#a,b}/*.md", false),
        (GlobSyntax::Posix, "{ ,b}", false),
        (GlobSyntax::Posix, "root/{ ,b}/x.md", true),
        (GlobSyntax::Posix, "{a,b}/x.md", true),
        (GlobSyntax::Posix, "{a,b}/", false),
        (GlobSyntax::Storybook, "root/@(a|b)/*.tsx", true),
        (GlobSyntax::Storybook, "?(a|b)/x.tsx", true),
        (GlobSyntax::Storybook, "root/?(a|b)/x.tsx", true),
        (GlobSyntax::Storybook, "root/x?(a|b)/x.tsx", true),
        (GlobSyntax::Storybook, "root/.?(a|b)/x.tsx", false),
        (GlobSyntax::Storybook, "root/@(x/|y)/x.tsx", false),
        (GlobSyntax::Storybook, "root/@(a|..)/*.tsx", false),
        (GlobSyntax::Storybook, "root/@(a|)/*.tsx", false),
        (GlobSyntax::Storybook, "root/x@(a|)/*.tsx", true),
        (GlobSyntax::Storybook, "root/{a,b}@(x|y)/x.tsx", true),
    ] {
        let result = compile(&[pattern], syntax);
        assert_eq!(result.is_ok(), accepted, "{pattern}: {result:?}");
    }
}

#[test]
fn optional_groups_keep_empty_matches_only_where_the_path_allows_them() {
    let matcher = compile(
        &["root/?(a|b)/x{a,{,}}?(One|Two).stories.tsx"],
        GlobSyntax::Storybook,
    )
    .unwrap();
    assert!(matcher.is_match("root/a/xa.stories.tsx"));
    assert!(matcher.is_match("root/b/xaTwo.stories.tsx"));
    assert!(!matcher.is_match("root/a/xOne.stories.tsx"));
    assert!(!matcher.is_match("root/xa.stories.tsx"));
}

#[test]
fn storybook_character_classes_keep_an_initial_closing_bracket() {
    for (pattern, matching, nonmatching) in [
        ("x[]@(a]y.stories.tsx", "xay.stories.tsx", "xby.stories.tsx"),
        (
            "x[!]@(a]y.stories.tsx",
            "xby.stories.tsx",
            "xay.stories.tsx",
        ),
        (
            "x[^]@(a]y.stories.tsx",
            "xby.stories.tsx",
            "xay.stories.tsx",
        ),
    ] {
        let matcher = compile(&[pattern], GlobSyntax::Storybook).unwrap();
        assert!(matcher.is_match(matching), "{pattern}");
        assert!(!matcher.is_match(nonmatching), "{pattern}");
    }
}
