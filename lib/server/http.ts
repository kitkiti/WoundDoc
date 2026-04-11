import { NextResponse } from "next/server";

export function jsonOk<T extends Record<string, unknown>>(payload: T, status = 200) {
  return NextResponse.json({ ok: true, ...payload }, { status });
}

export function jsonError(message: string, status = 400, detail?: string) {
  return NextResponse.json(
    {
      ok: false,
      error: message,
      ...(detail ? { detail } : {})
    },
    { status }
  );
}

export function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
