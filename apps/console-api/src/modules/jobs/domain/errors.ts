export type JobErrorCode =
  | "JOB_NOT_FOUND"
  | "JOB_INVALID_STATE"
  | "INVALID_BODY"
  | "INTERNAL_ERROR";

export class JobServiceError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: JobErrorCode,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "JobServiceError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}
