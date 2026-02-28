import { randomUUID } from "node:crypto";

export interface CorrelationContext {
  requestId: string;
  traceId: string;
}

function getHeaderValue(
  value: string | string[] | undefined
): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (Array.isArray(value) && value.length > 0) {
    return value[0];
  }

  return undefined;
}

export function resolveCorrelationContext(headers: {
  [key: string]: string | string[] | undefined;
}): CorrelationContext {
  const requestId =
    getHeaderValue(headers["x-request-id"]) ??
    getHeaderValue(headers["request-id"]) ??
    randomUUID();

  const traceId = getHeaderValue(headers["x-trace-id"]) ?? randomUUID();

  return { requestId, traceId };
}
