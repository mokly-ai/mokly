//! Private pool opt-in and supported native volume identities for capture witnesses.

use serde::{Deserialize, Serialize};
use ts_rs::TS;

use mokly_platform::volumes::LocalVolume;

/// A pool with a bundle store requests capture durability checks.
#[derive(Clone, Debug, Default, Deserialize, Serialize, TS)]
pub struct CaptureHint {
    /// At most 64 supported native volumes, within a 64 KiB hello hint.
    pub volumes: Vec<CaptureVolume>,
}

impl CaptureHint {
    /// Keep a bounded subset; unreported volumes cannot produce durable evidence.
    pub(crate) fn from_volumes(volumes: Vec<LocalVolume>) -> Self {
        let mut hint = Self::default();
        for volume in volumes.into_iter().take(64) {
            hint.volumes.push(match volume {
                LocalVolume::Macos { dev, fs_type } => CaptureVolume::Macos {
                    dev: dev.to_string(),
                    fs_type,
                },
                LocalVolume::Windows { serial, roots } => CaptureVolume::Windows {
                    dev: serial.to_string(),
                    roots,
                },
            });
            if !matches!(serde_json::to_vec(&hint), Ok(bytes) if bytes.len() <= 64 * 1024) {
                hint.volumes.pop();
                break;
            }
        }
        hint
    }
}

/// A local volume whose directory and metadata stamps can verify capture.
#[derive(Clone, Debug, Deserialize, Serialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum CaptureVolume {
    /// A local APFS or HFS mount; Node must also match the current statfs type.
    Macos {
        /// Decimal st_dev, without JavaScript integer precision loss.
        dev: String,
        /// The current getfsstat filesystem type number.
        #[serde(rename = "fsType")]
        fs_type: u32,
    },
    /// A fixed NTFS or ReFS volume, excluding UNC paths.
    Windows {
        /// Decimal volume serial number, checked against Node's stat.dev.
        dev: String,
        /// Absolute mount roots, including any mounted directory roots.
        roots: Vec<String>,
    },
}

#[cfg(test)]
#[path = "_tests_/capture_hint_tests.rs"]
mod capture_hint_tests;
