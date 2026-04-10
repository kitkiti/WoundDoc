import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function round(value: number, precision = 0) {
  if (!Number.isFinite(value)) {
    return value;
  }

  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

export function toPercent(value: number | null | undefined, precision = 0) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "Not available";
  }

  return `${round(value * 100, precision)}%`;
}

export function formatTimestamp(value: string | null | undefined) {
  if (!value) {
    return "Not available";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}
