//! Read-only enumeration of native volumes with coherent directory change stamps.

#[cfg(target_os = "macos")]
mod macos;
#[cfg(windows)]
mod windows;

/// Native facts used to construct a private capture hint.
#[derive(Clone, Debug)]
pub enum LocalVolume {
    /// Local APFS or HFS mount identity and the current statfs type.
    Macos {
        /// Mount-point st_dev.
        dev: u64,
        /// Kernel filesystem type number.
        fs_type: u32,
    },
    /// Fixed NTFS or ReFS serial and all available mount roots.
    Windows {
        /// Volume serial as reported by GetVolumeInformationW.
        serial: u32,
        /// Absolute drive or directory mount roots.
        roots: Vec<String>,
    },
}

/// Optional volume discovery fails closed without failing a compile.
#[cfg_attr(any(test, feature = "mock"), unimock::unimock(api = CaptureVolumesMock))]
pub trait CaptureVolumes: Send + Sync {
    /// Return at most 64 supported volumes without changing any filesystem.
    fn local(&self) -> Vec<LocalVolume>;
}

/// System volume enumeration; Linux classifies volumes inside Node instead.
pub struct SystemCaptureVolumes;

impl CaptureVolumes for SystemCaptureVolumes {
    fn local(&self) -> Vec<LocalVolume> {
        #[cfg(target_os = "macos")]
        return macos::local();
        #[cfg(windows)]
        return windows::local();
        #[cfg(not(any(target_os = "macos", windows)))]
        Vec::new()
    }
}
