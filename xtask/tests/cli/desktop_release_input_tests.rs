//! Real release-input resolution and version/tag rejection cases.

use std::fs;
use std::process::Command;

use serde_json::Value;

use super::support::repository;

#[test]
fn desktop_release_inputs_use_the_deployment_domain_owner() {
    for (environment, expected) in [
        (
            "production",
            "EXPO_PUBLIC_MKC_API_ORIGIN=https://api.app.example\n\
             EXPO_PUBLIC_MKC_APP_ORIGIN=https://app.example\n\
             MKC_CATALOGUE_BASE_DOMAIN=catalogue.example\n",
        ),
        (
            "main-preview",
            "EXPO_PUBLIC_MKC_API_ORIGIN=https://br-main.preview.api.app.example\n\
             EXPO_PUBLIC_MKC_APP_ORIGIN=https://br-main.preview.app.example\n\
             MKC_CATALOGUE_BASE_DOMAIN=br-main.preview.catalogue.example\n",
        ),
    ] {
        let result = Command::new("python3")
            .current_dir(repository())
            .args([
                "packages/desktop/scripts/release-environment.py",
                environment,
            ])
            .env("MKC_DOMAIN", "app.example")
            .env("MKC_CATALOGUE_BASE_DOMAIN", "catalogue.example")
            .output()
            .unwrap();
        assert!(result.status.success(), "{:?}", result);
        assert_eq!(String::from_utf8(result.stdout).unwrap(), expected);
    }
}

#[test]
fn desktop_release_tag_must_equal_the_package_version() {
    let package: Value = serde_json::from_str(
        &fs::read_to_string(repository().join("packages/desktop/package.json")).unwrap(),
    )
    .unwrap();
    let version = package["version"].as_str().unwrap();
    for (tag, accepted) in [
        (format!("desktop-v{version}"), true),
        (format!("v{version}"), false),
        (format!("desktop-v{version}-wrong"), false),
        ("desktop-v999.0.0".to_owned(), false),
    ] {
        let result = Command::new("python3")
            .current_dir(repository())
            .args([
                "packages/desktop/scripts/release-environment.py",
                "production",
                "--tag",
                &tag,
            ])
            .env("MKC_DOMAIN", "app.example")
            .env("MKC_CATALOGUE_BASE_DOMAIN", "catalogue.example")
            .output()
            .unwrap();
        assert_eq!(result.status.success(), accepted, "{tag}: {result:?}");
        if !accepted {
            assert!(result.stdout.is_empty());
            assert!(String::from_utf8(result.stderr).unwrap().contains(version));
        }
    }
}

#[test]
fn desktop_fork_builds_resolve_public_metadata_without_repository_variables() {
    let code = r#"
import io, json, runpy, sys
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlsplit
package = json.loads(Path('packages/desktop/package.json').read_text())
domain = urlsplit(package['homepage']).hostname
expected_app = f'https://br-main.preview.{domain}'
calls = []
def public_config(url, timeout):
    calls.append(url)
    return io.BytesIO(json.dumps({'catalogueBaseDomain': 'public-catalogue.example'}).encode())
sys.argv = ['packages/desktop/scripts/release-environment.py', 'main-preview']
with patch('urllib.request.urlopen', public_config):
    runpy.run_path(sys.argv[0], run_name='__main__')
assert calls == [expected_app + '/_config'], calls
"#;
    let result = Command::new("python3")
        .current_dir(repository())
        .args(["-c", code])
        .env("MKC_DOMAIN", "")
        .env("MKC_CATALOGUE_BASE_DOMAIN", "")
        .output()
        .unwrap();
    assert!(result.status.success(), "{result:?}");
    assert!(
        String::from_utf8(result.stdout)
            .unwrap()
            .contains("MKC_CATALOGUE_BASE_DOMAIN=br-main.preview.public-catalogue.example")
    );
}
