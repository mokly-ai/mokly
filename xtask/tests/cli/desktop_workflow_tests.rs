//! Electron download isolation and hosted desktop prerequisites.

use std::fs;

use super::support::repository;

#[test]
fn desktop_ci_has_a_cached_binary_and_its_system_dependencies() {
    let text = fs::read_to_string(repository().join(".github/workflows/ci.yml")).unwrap();
    assert!(text.contains("command: cloud-desktop"));
    assert!(text.contains("browser_workspace: \"@mokly-cloud/desktop\""));
    assert!(text.contains(
        "ELECTRON_SKIP_BINARY_DOWNLOAD: ${{ matrix.command != 'cloud-desktop' && '1' || '' }}"
    ));
    assert!(text.contains("path: ~/.cache/electron"));
    assert!(text.contains("key: electron-${{ runner.os }}-${{ runner.arch }}-44.7.2"));
    assert!(text.contains(
        "if: matrix.command == 'cloud-desktop'\n        run: sudo apt-get install -y xvfb"
    ));
    for workflow in ["deploy", "preview", "site"] {
        let path = repository().join(format!(".github/workflows/{workflow}.yml"));
        assert!(
            fs::read_to_string(path)
                .unwrap()
                .contains("ELECTRON_SKIP_BINARY_DOWNLOAD: \"1\"")
        );
    }
    let dockerfile = fs::read_to_string(repository().join("infra/docker/app.Dockerfile")).unwrap();
    assert!(dockerfile.contains("ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci"));
}
