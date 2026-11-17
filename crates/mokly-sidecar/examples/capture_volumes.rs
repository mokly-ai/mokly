//! One-time native volume proof, outside the permanent tests and gate.

use mokly_platform::volumes::{CaptureVolumes, LocalVolume, SystemCaptureVolumes};
use mokly_sidecar::capture_hint::{CaptureHint, CaptureVolume};

fn main() {
    let volumes = SystemCaptureVolumes.local().into_iter().map(|volume| match volume {
        LocalVolume::Macos { dev, fs_type } => CaptureVolume::Macos { dev: dev.to_string(), fs_type },
        LocalVolume::Windows { serial, roots } => CaptureVolume::Windows { dev: serial.to_string(), roots },
    }).collect();
    println!("{}", serde_json::to_string(&CaptureHint { volumes }).unwrap());
}
