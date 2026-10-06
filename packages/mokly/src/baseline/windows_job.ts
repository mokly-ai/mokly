/** Fixed Win32 bindings; the non-inheritable job owns descendants before commands start. */
import { setTimeout } from "node:timers/promises";

import type koffi from "koffi";

const EXTENDED_LIMIT_INFORMATION = 9;
const BASIC_JOB_INFORMATION = 1;
const KILL_ON_JOB_CLOSE = 0x2000;
const PROCESS_SET_QUOTA_AND_TERMINATE = 0x0101;
/** Fixed-width fields in the Win32 job-status and limit structures. */
const JOB_INFORMATION_BYTES = 48;
const ACTIVE_PROCESSES_OFFSET = 40;
const LIMIT_FLAGS_OFFSET = 16;

export interface WindowsProcessJob {
  assign(pid: number): void;
  terminate(): void;
  dispose(): Promise<void>;
}

interface JobApi {
  create(attributes: null, name: null): unknown;
  configure(job: unknown, kind: number, data: Buffer, size: number): number;
  open(access: number, inherit: number, pid: number): unknown;
  assign(job: unknown, process: unknown): number;
  terminate(job: unknown, code: number): number;
  query(
    job: unknown,
    kind: number,
    data: Buffer,
    size: number,
    returned: null,
  ): number;
  close(handle: unknown): number;
  lastError(): number;
}

export async function createWindowsProcessJob(): Promise<WindowsProcessJob> {
  const { default: bridge } = await import("koffi");
  const library = bridge.load("kernel32.dll");
  const api: JobApi = {
    create: library.func("__stdcall", "CreateJobObjectW", "void *", [
      "void *",
      "str16",
    ]),
    configure: library.func("__stdcall", "SetInformationJobObject", "int", [
      "void *",
      "int",
      "void *",
      "uint32",
    ]),
    open: library.func("__stdcall", "OpenProcess", "void *", [
      "uint32",
      "int",
      "uint32",
    ]),
    assign: library.func("__stdcall", "AssignProcessToJobObject", "int", [
      "void *",
      "void *",
    ]),
    terminate: library.func("__stdcall", "TerminateJobObject", "int", [
      "void *",
      "uint32",
    ]),
    query: library.func("__stdcall", "QueryInformationJobObject", "int", [
      "void *",
      "int",
      "void *",
      "uint32",
      "void *",
    ]),
    close: library.func("__stdcall", "CloseHandle", "int", ["void *"]),
    lastError: library.func("__stdcall", "GetLastError", "uint32", []),
  };
  const handle = api.create(null, null);
  if (!handle) throw jobError(api, "CreateJobObjectW");
  try {
    const limits = jobLimits(bridge);
    if (
      !api.configure(handle, EXTENDED_LIMIT_INFORMATION, limits, limits.length)
    )
      throw jobError(api, "SetInformationJobObject");
    return new NativeWindowsProcessJob(api, handle);
  } catch (error) {
    api.close(handle);
    throw error;
  }
}

class NativeWindowsProcessJob implements WindowsProcessJob {
  private handle: unknown;

  constructor(
    private readonly api: JobApi,
    handle: unknown,
  ) {
    this.handle = handle;
  }

  assign(pid: number): void {
    const processHandle = this.api.open(
      PROCESS_SET_QUOTA_AND_TERMINATE,
      0,
      pid,
    );
    if (!processHandle) throw jobError(this.api, "OpenProcess");
    try {
      if (!this.api.assign(this.handle, processHandle))
        throw jobError(this.api, "AssignProcessToJobObject");
    } finally {
      this.api.close(processHandle);
    }
  }

  terminate(): void {
    if (!this.handle) return;
    if (!this.api.terminate(this.handle, 1)) {
      const error = jobError(this.api, "TerminateJobObject");
      this.closeHandle();
      throw error;
    }
  }

  async dispose(): Promise<void> {
    if (!this.handle) return;
    try {
      this.terminate();
      const jobInformation = Buffer.alloc(JOB_INFORMATION_BYTES);
      while (true) {
        if (
          !this.api.query(
            this.handle,
            BASIC_JOB_INFORMATION,
            jobInformation,
            jobInformation.length,
            null,
          )
        )
          throw jobError(this.api, "QueryInformationJobObject");
        if (jobInformation.readUInt32LE(ACTIVE_PROCESSES_OFFSET) === 0) break;
        await setTimeout(10);
      }
    } finally {
      this.closeHandle();
    }
  }

  private closeHandle(): void {
    if (!this.handle) return;
    const handle = this.handle;
    this.handle = undefined;
    if (!this.api.close(handle)) throw jobError(this.api, "CloseHandle");
  }
}

/** Native-sized fields keep the Win32 structure valid on both 32- and 64-bit hosts. */
function jobLimits(bridge: typeof koffi): Buffer {
  const basic = bridge.struct({
    PerProcessUserTimeLimit: "int64",
    PerJobUserTimeLimit: "int64",
    LimitFlags: "uint32",
    MinimumWorkingSetSize: "size_t",
    MaximumWorkingSetSize: "size_t",
    ActiveProcessLimit: "uint32",
    Affinity: "uintptr_t",
    PriorityClass: "uint32",
    SchedulingClass: "uint32",
  });
  const extended = bridge.struct({
    BasicLimitInformation: basic,
    IoInfo: bridge.array("uint64", 6),
    ProcessMemoryLimit: "size_t",
    JobMemoryLimit: "size_t",
    PeakProcessMemoryUsed: "size_t",
    PeakJobMemoryUsed: "size_t",
  });
  const buffer = Buffer.alloc(bridge.sizeof(extended));
  buffer.writeUInt32LE(KILL_ON_JOB_CLOSE, LIMIT_FLAGS_OFFSET);
  return buffer;
}

function jobError(api: JobApi, operation: string): Error {
  return new Error(
    `Windows baseline job ${operation} failed (${api.lastError()})`,
  );
}
