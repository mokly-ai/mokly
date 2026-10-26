//! A text scanner for shell commands that can delete shared remote Git state.
//!
//! It splits a `run:` script into command segments and reads each `git`
//! invocation with its global options. It cannot see commands inside the
//! scripts that a step calls.

use std::mem;

/// The command segments of the scripts that can delete shared remote Git
/// state: remotes, remote-tracking references, or upstream settings.
pub(crate) fn remote_state_deleting_commands(commands: &[&str]) -> Vec<String> {
    commands
        .iter()
        .flat_map(|command| shell_command_segments(command))
        .filter(|segment| is_remote_state_deleting_command(segment))
        .collect()
}

fn is_remote_state_deleting_command(command: &str) -> bool {
    if command.to_lowercase().contains("remove-remote-state") {
        return true;
    }
    let tokens = shell_tokens(command);
    if tokens.first().map(String::as_str) != Some("git") {
        return false;
    }
    let Some((subcommand, args)) = git_invocation(&tokens) else {
        return false;
    };
    let has = |options: &[&str]| args.iter().any(|value| options.contains(&value.as_str()));
    match subcommand {
        "remote" => matches!(args.first().map(String::as_str), Some("remove" | "rm")),
        "update-ref" => {
            has(&["-d", "--delete", "--stdin"])
                || args.iter().any(|value| value.contains("refs/remotes"))
        }
        "branch" => {
            has(&["--unset-upstream"])
                || has(&["-dr", "-rd", "-Dr", "-rD"])
                || (has(&["-d", "-D", "--delete"]) && has(&["-r", "--remotes"]))
        }
        "config" => {
            has(&["--unset", "--unset-all", "--remove-section"])
                && args.iter().any(|value| {
                    let value = value.to_lowercase();
                    value.starts_with("remote.") || value.starts_with("branch.")
                })
        }
        _ => false,
    }
}

/// The Git subcommand and its arguments after the global options.
fn git_invocation(tokens: &[String]) -> Option<(&str, &[String])> {
    let mut index = 1;
    while index < tokens.len() {
        let value = tokens[index].as_str();
        if value == "-C" || value == "-c" {
            index += 2;
        } else if value.starts_with('-') {
            index += 1;
        } else {
            return Some((value, &tokens[index + 1..]));
        }
    }
    None
}

/// The commands of a script, split at unquoted newlines and at `;`, `|`,
/// `&`, `||`, and `&&`, after joining backslash-continued lines.
fn shell_command_segments(source: &str) -> Vec<String> {
    let input: Vec<char> = source
        .replace("\\\r\n", " ")
        .replace("\\\n", " ")
        .chars()
        .collect();
    let mut segments = Vec::new();
    let mut quote = None;
    let mut start = 0;
    let mut index = 0;
    while index < input.len() {
        let character = input[index];
        if let Some(open) = quote {
            if character == open {
                quote = None;
            } else if character == '\\' && open == '"' {
                index += 1;
            }
        } else if character == '\'' || character == '"' {
            quote = Some(character);
        } else if character == '\\' {
            index += 1;
        } else if matches!(character, '\n' | ';' | '|' | '&') {
            push_segment(&mut segments, &input[start..index]);
            start = index + 1;
            if input.get(index + 1) == Some(&character) {
                index += 1;
                start += 1;
            }
        }
        index += 1;
    }
    push_segment(&mut segments, &input[start.min(input.len())..]);
    segments
}

fn push_segment(segments: &mut Vec<String>, characters: &[char]) {
    let segment: String = characters.iter().collect();
    let segment = segment.trim();
    if !segment.is_empty() {
        segments.push(segment.to_owned());
    }
}

/// The words of one command, with quotes removed and backslash escapes read.
fn shell_tokens(command: &str) -> Vec<String> {
    let characters: Vec<char> = command.chars().collect();
    let mut tokens = Vec::new();
    let mut token = String::new();
    let mut quote = None;
    let mut index = 0;
    while index < characters.len() {
        let character = characters[index];
        if let Some(open) = quote {
            if character == open {
                quote = None;
            } else if character == '\\' && open == '"' {
                index += 1;
                token.extend(characters.get(index));
            } else {
                token.push(character);
            }
        } else if character == '\'' || character == '"' {
            quote = Some(character);
        } else if character.is_whitespace() {
            finish_token(&mut tokens, &mut token);
        } else if character == '\\' {
            index += 1;
            token.extend(characters.get(index));
        } else {
            token.push(character);
        }
        index += 1;
    }
    finish_token(&mut tokens, &mut token);
    tokens
}

fn finish_token(tokens: &mut Vec<String>, token: &mut String) {
    if !token.is_empty() {
        tokens.push(mem::take(token));
    }
}
