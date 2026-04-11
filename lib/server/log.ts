const LOG_LEVEL = process.env.WOUNDDOC_LOG_LEVEL ?? "debug";

export function logStage(stage: string, payload: unknown) {
  if (LOG_LEVEL === "silent") {
    return;
  }

  console.log(`[WoundWatch] ${stage}`, JSON.stringify(payload, null, 2));
}
