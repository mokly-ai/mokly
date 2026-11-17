//! Native hints keep exact device identities and bounded wire data.

use mokly_platform::volumes::LocalVolume;

use crate::capture_hint::CaptureHint;

#[test]
fn capture_hints_keep_device_precision_and_bound_volumes_and_encoded_bytes() {
    let hint = CaptureHint::from_volumes(vec![
        LocalVolume::Macos {
            dev: u64::MAX,
            fs_type: 24,
        },
        LocalVolume::Windows {
            serial: u32::MAX,
            roots: vec!["C:\\".into()],
        },
    ]);
    let json = serde_json::to_value(hint).unwrap();
    assert_eq!(json["volumes"][0]["dev"], "18446744073709551615");
    assert_eq!(json["volumes"][0]["fsType"], 24);
    assert_eq!(json["volumes"][1]["dev"], "4294967295");
    assert_eq!(json["volumes"][1]["roots"][0], "C:\\");
    let many = CaptureHint::from_volumes(
        (0..65)
            .map(|dev| LocalVolume::Macos { dev, fs_type: 24 })
            .collect(),
    );
    assert_eq!(many.volumes.len(), 64);
    let huge = CaptureHint::from_volumes(vec![LocalVolume::Windows {
        serial: 1,
        roots: vec!["x".repeat(64 * 1024)],
    }]);
    assert_eq!(huge.volumes.len(), 0);
}
