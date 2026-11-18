//! Bounded fixed-volume enumeration with NTFS and ReFS mount roots.

use windows_sys::Win32::Foundation::INVALID_HANDLE_VALUE;
use windows_sys::Win32::Storage::FileSystem::{
    FindFirstVolumeW, FindNextVolumeW, FindVolumeClose, GetDriveTypeW, GetVolumeInformationW,
    GetVolumePathNamesForVolumeNameW,
};
use windows_sys::Win32::System::WindowsProgramming::DRIVE_FIXED;

use super::LocalVolume;

pub(super) fn local() -> Vec<LocalVolume> {
    let mut name = vec![0u16; 32768];
    // SAFETY: the buffer is writable for the supplied WCHAR count.
    let handle = unsafe { FindFirstVolumeW(name.as_mut_ptr(), name.len() as u32) };
    if handle == INVALID_HANDLE_VALUE {
        return vec![];
    }
    let mut volumes = Vec::new();
    for _ in 0..64 {
        if let Some(volume) = volume(&name) {
            volumes.push(volume);
        }
        // SAFETY: handle is the live enumeration handle, and name is writable.
        if unsafe { FindNextVolumeW(handle, name.as_mut_ptr(), name.len() as u32) } == 0 {
            break;
        }
    }
    // SAFETY: this handle was returned by FindFirstVolumeW and is closed once.
    unsafe { FindVolumeClose(handle) };
    volumes
}

fn volume(name: &[u16]) -> Option<LocalVolume> {
    // SAFETY: FindFirst/NextVolumeW supplied a terminated volume GUID path.
    if unsafe { GetDriveTypeW(name.as_ptr()) } != DRIVE_FIXED {
        return None;
    }
    let mut serial = 0;
    let mut kind = [0u16; 32];
    // SAFETY: all output pointers name live writable buffers of the stated size.
    let read = unsafe {
        GetVolumeInformationW(
            name.as_ptr(),
            std::ptr::null_mut(),
            0,
            &mut serial,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
            kind.as_mut_ptr(),
            kind.len() as u32,
        )
    };
    let end = kind.iter().position(|v| *v == 0)?;
    let kind = String::from_utf16(&kind[..end]).ok()?;
    if read == 0 || (kind != "NTFS" && kind != "ReFS") {
        return None;
    }
    let mut needed = 0;
    // SAFETY: the null buffer with zero length requests the required WCHAR count.
    unsafe {
        GetVolumePathNamesForVolumeNameW(name.as_ptr(), std::ptr::null_mut(), 0, &mut needed)
    };
    if needed == 0 || needed > 32768 {
        return None;
    }
    let mut paths = vec![0u16; needed as usize];
    // SAFETY: paths is writable for exactly needed WCHARs; name is terminated.
    if unsafe {
        GetVolumePathNamesForVolumeNameW(name.as_ptr(), paths.as_mut_ptr(), needed, &mut needed)
    } == 0
    {
        return None;
    }
    let roots = paths
        .split(|v| *v == 0)
        .take_while(|v| !v.is_empty())
        .map(String::from_utf16)
        .collect::<Result<Vec<_>, _>>()
        .ok()?;
    Some(LocalVolume::Windows { serial, roots })
}
