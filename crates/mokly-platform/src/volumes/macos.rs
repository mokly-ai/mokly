//! Bounded, nonblocking local APFS and HFS mount discovery.

use std::ffi::OsString;
use std::fs;
use std::mem;
use std::os::unix::ffi::OsStringExt;
use std::os::unix::fs::MetadataExt;

use super::LocalVolume;

pub(super) fn local() -> Vec<LocalVolume> {
    // SAFETY: statfs is a C record for which all-zero bytes are valid. getfsstat
    // receives the initialized allocation and its exact writable byte capacity.
    let mut mounts: Vec<libc::statfs> = (0..64).map(|_| unsafe { mem::zeroed() }).collect();
    // SAFETY: the buffer holds 64 records and remains live for this synchronous call.
    let count = unsafe {
        libc::getfsstat(
            mounts.as_mut_ptr(),
            mem::size_of_val(mounts.as_slice()) as libc::c_int,
            libc::MNT_NOWAIT,
        )
    };
    if count < 0 {
        return vec![];
    }
    mounts
        .iter()
        .take((count as usize).min(mounts.len()))
        .filter(|mount| mount.f_flags & libc::MNT_LOCAL as u32 != 0)
        .filter(|mount| {
            let name: Vec<u8> = mount
                .f_fstypename
                .iter()
                .take_while(|v| **v != 0)
                .map(|v| *v as u8)
                .collect();
            name == b"apfs" || name == b"hfs"
        })
        .filter_map(|mount| {
            let name: Vec<u8> = mount
                .f_mntonname
                .iter()
                .take_while(|v| **v != 0)
                .map(|v| *v as u8)
                .collect();
            let metadata = fs::metadata(OsString::from_vec(name)).ok()?;
            Some(LocalVolume::Macos {
                dev: metadata.dev(),
                fs_type: mount.f_type,
            })
        })
        .collect()
}
