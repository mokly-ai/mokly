//! PostCSS reads keep their identity and byte ranges, and valid read positions still work.

use std::fs;
use std::path::Path;

use mokly_test_support::files::{tree, write};
use mokly_test_support::process::Finished;
use mokly_test_support::publication;
use regex::Regex;

use super::support::mokly;

const THEME_CONFIG: &str =
    r#"{"postcss":"postcss.mjs","stylesheets":[{"match":"**","stylesheets":["theme.css"]}]}"#;

fn build(root: &Path, edit: Option<&str>) -> Finished {
    let invocation = mokly().command(
        root,
        &["build", "--no-changes", "--out=.context/site"],
        "plain",
    );
    match edit {
        Some(name) => invocation.env(name, "1").run(),
        None => invocation.run(),
    }
}

fn rejects_the_changed_input(root: &Path, edit: &str) {
    let stable = build(root, None);
    assert_eq!(stable.code, Some(0), "{}", stable.stderr);
    let previous = tree(&root.join(".context/site"));
    let changed = build(root, Some(edit));
    assert_eq!(changed.code, Some(1), "{}", changed.stderr);
    let pattern =
        Regex::new(r"\[mokly/export-invalid\] Inputs changed during the build:.*tokens\.txt")
            .unwrap();
    assert!(pattern.is_match(&changed.stderr), "{}", changed.stderr);
    assert!(tree(&root.join(".context/site")) == previous);
}

#[cfg(unix)]
fn identity(read: &str) {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    write(path, "a.txt", "red");
    write(path, "b.txt", "red");
    std::os::unix::fs::symlink("a.txt", path.join("tokens.txt")).unwrap();
    write(path, "theme.css", "a{color:black}");
    write(path, "mokly.config.json", THEME_CONFIG);
    write(
        path,
        "postcss.mjs",
        format!(
            "
import fs from 'node:fs';
import {{open,readFile}} from 'node:fs/promises';
export default {{plugins:[{{postcssPlugin:'identity',async Once(root,{{result}}){{
{read}
root.walkDecls('color',declaration=>{{declaration.value=value}});
if(process.env.MOKLY_TEST_RETARGET){{fs.unlinkSync('tokens.txt');fs.symlinkSync('b.txt','tokens.txt','file');}}
result.messages.push({{type:'dependency',file:'tokens.txt'}});
}}}}]}};"
        ),
    );
    rejects_the_changed_input(path, "MOKLY_TEST_RETARGET");
}

#[cfg(unix)]
#[test]
fn postcss_reads_of_every_api_retain_identity_before_a_same_byte_symlink_retarget() {
    for read in [
        "const value=fs.readFileSync('tokens.txt','utf8');",
        "const value=await new Promise((resolve,reject)=>fs.readFile('tokens.txt','utf8',(error,bytes)=>error?reject(error):resolve(bytes)));",
        "const value=await readFile('tokens.txt','utf8');",
        "const fd=fs.openSync('tokens.txt','r');const bytes=Buffer.alloc(3);fs.readSync(fd,bytes,0,3,0);fs.closeSync(fd);const value=bytes.toString();",
        "const handle=await open('tokens.txt','r');const value=await handle.readFile('utf8');await handle.close();",
        "const value=await new Promise((resolve,reject)=>fs.readFile('tokens.txt',{encoding:'utf8',flag:'rs'},(error,bytes)=>error?reject(error):resolve(bytes)));",
        "const value=await readFile('tokens.txt',{encoding:'utf8',flag:'r+'});",
    ] {
        identity(read);
    }
}

fn changed_range(reader: &str) {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    write(path, "tokens.txt", "red-unused");
    write(path, "theme.css", "a{color:black}");
    write(path, "mokly.config.json", THEME_CONFIG);
    let read = if reader == "handle" {
        "const handle=await open('tokens.txt','r'); await handle.read(buffer,0,3,0); await handle.close();"
    } else {
        "const fd=fs.openSync('tokens.txt','r'); fs.readSync(fd,buffer,0,3,0); fs.closeSync(fd);"
    };
    write(
        path,
        "postcss.mjs",
        format!(
            "
import fs from 'node:fs';
import {{open}} from 'node:fs/promises';
export default {{plugins:[{{postcssPlugin:'range',async Once(root,{{result}}){{
const buffer=Buffer.alloc(3);
{read}
root.walkDecls('color',declaration=>{{declaration.value=buffer.toString()}});
if(process.env.MOKLY_TEST_RANGE_EDIT)fs.writeFileSync('tokens.txt','tan-unused');
result.messages.push({{type:'dependency',file:'tokens.txt'}});
}}}}]}};"
        ),
    );
    rejects_the_changed_input(path, "MOKLY_TEST_RANGE_EDIT");
}

#[test]
fn static_build_rejects_a_changed_descriptor_range_before_installation() {
    changed_range("descriptor");
}

#[test]
fn static_build_rejects_a_changed_handle_range_before_installation() {
    changed_range("handle");
}

fn valid_position(operation: &str) {
    let root = publication::fixture(false, "sha1");
    let path = root.path();
    write(path, "tokens.txt", "abcdef");
    write(path, "theme.css", "a{color:black}");
    write(path, "mokly.config.json", THEME_CONFIG);
    write(
        path,
        "postcss.mjs",
        format!(
            "import assert from 'node:assert/strict'; import fs from 'node:fs';
export default {{plugins:[{{postcssPlugin:'positions',Once(root,{{result}}){{
const fd=fs.openSync('tokens.txt','r');
assert.equal({operation},1);
const bytes=Buffer.alloc(1);fs.readSync(fd,bytes,0,1,null);fs.closeSync(fd);
assert.equal(bytes.toString(),'b');
root.walkDecls('color',decl=>decl.value=bytes.toString());
result.messages.push({{type:'dependency',file:'tokens.txt'}});
}}}}]}};"
        ),
    );
    let result = build(path, None);
    assert_eq!(result.code, Some(0), "{}", result.stderr);
    assert_eq!(
        fs::read_to_string(path.join("tokens.txt")).unwrap(),
        "abcdef"
    );
}

#[test]
fn static_builds_preserve_valid_bigint_read_positions() {
    valid_position("fs.readSync(fd,Buffer.alloc(1),0,1,-1n)");
}

#[test]
fn static_builds_preserve_valid_vector_nan_read_positions() {
    valid_position("fs.readvSync(fd,[Buffer.alloc(1)],NaN)");
}
