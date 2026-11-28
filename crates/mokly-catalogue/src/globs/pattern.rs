//! Lower Storybook groups into globset alternatives and check authored paths.

use std::iter::Peekable;
use std::str::Chars;

use super::GlobError;
use super::validation::{Branches, Validation};

#[derive(Clone, Copy, PartialEq, Eq)]
enum GroupKind {
    Brace,
    Bare,
    Required,
    Optional,
}

impl GroupKind {
    fn separator(self) -> char {
        if self == Self::Brace { ',' } else { '|' }
    }

    fn closes(self, character: char) -> bool {
        character == if self == Self::Brace { '}' } else { ')' }
    }
}

struct Group {
    kind: GroupKind,
    start: usize,
    branch_start: usize,
    branches: Branches,
}

impl Group {
    fn write_branch(&mut self, text: &mut String) {
        if self.kind != GroupKind::Brace || text.len() != self.branch_start {
            text.push(',');
        }
        self.branch_start = text.len();
    }
}

#[derive(Default)]
struct Compiler {
    text: String,
    groups: Vec<Group>,
    validation: Validation,
}

pub(super) fn compile_groups(pattern: &str, storybook: bool) -> Result<String, GlobError> {
    let mut compiler = Compiler::default();
    let mut characters = pattern.chars().peekable();
    while let Some(character) = characters.next() {
        match character {
            '[' => compiler.class(&mut characters),
            '{' => compiler.open(GroupKind::Brace),
            '(' if storybook => {
                if characters.peek() == Some(&'?') {
                    return Err(GlobError::UnsupportedGroup(pattern.into()));
                }
                compiler.open(GroupKind::Bare);
            }
            '@' | '?' | '*' | '+' | '!' if storybook && characters.peek() == Some(&'(') => {
                characters.next();
                compiler.open(match character {
                    '@' => GroupKind::Required,
                    '?' => GroupKind::Optional,
                    _ => return Err(GlobError::UnsupportedExtglob(character)),
                });
            }
            character if compiler.in_group(|kind| kind.separator() == character) => {
                compiler.branch();
            }
            character if compiler.in_group(|kind| kind.closes(character)) => {
                compiler.close();
            }
            ',' if compiler.in_group(|kind| kind != GroupKind::Brace) => {
                compiler.validation.push(',');
                compiler.text.push_str("[,]");
            }
            character => compiler.literal(character),
        }
    }
    match compiler.groups.last().map(|group| group.kind) {
        Some(GroupKind::Brace) => return Err(GlobError::UnclosedBrace(pattern.into())),
        Some(GroupKind::Bare) => return Err(GlobError::UnsupportedGroup(pattern.into())),
        Some(_) => return Err(GlobError::UnclosedExtglob),
        None => {}
    }
    if let Some(alternative) = compiler.validation.unsafe_alternative() {
        return Err(GlobError::Unsafe(alternative));
    }
    Ok(compiler.text)
}

impl Compiler {
    fn in_group(&self, check: impl FnOnce(GroupKind) -> bool) -> bool {
        self.groups.last().is_some_and(|group| check(group.kind))
    }

    fn literal(&mut self, character: char) {
        self.text.push(character);
        self.validation.push(character);
    }

    fn class(&mut self, characters: &mut Peekable<Chars<'_>>) {
        self.literal('[');
        if characters.peek().is_some_and(|c| matches!(c, '!' | '^'))
            && let Some(negation) = characters.next()
        {
            self.literal(negation);
        }
        if characters.next_if_eq(&']').is_some() {
            self.literal(']');
        }
        for character in characters.by_ref() {
            self.literal(character);
            if character == ']' {
                break;
            }
        }
    }

    fn open(&mut self, kind: GroupKind) {
        let start = self.text.len();
        self.text.push('{');
        self.groups.push(Group {
            kind,
            start,
            branch_start: self.text.len(),
            branches: self.validation.open(),
        });
    }

    fn branch(&mut self) {
        if let Some(group) = self.groups.last_mut() {
            group.write_branch(&mut self.text);
            self.validation.branch(&mut group.branches);
        }
    }

    fn close(&mut self) {
        if let Some(mut group) = self.groups.pop() {
            group.write_branch(&mut self.text);
            let optional = group.kind == GroupKind::Optional;
            if group.kind == GroupKind::Brace && self.text.len() == group.start + 1 {
                self.text.truncate(group.start);
            } else {
                if !optional {
                    self.text.pop();
                }
                self.text.push('}');
            }
            self.validation.close(group.branches, optional);
        }
    }
}
