import type { TimedJob } from "./ci-timing-jobs.mjs";

export function formatSeconds(seconds: number): string;

export function cell(text: string): string;

export function escapeCommand(text: string): string;

export function jobCell(job: Pick<TimedJob, "name" | "url">): string;
