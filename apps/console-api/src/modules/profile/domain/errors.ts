export type DomainErrorCode =
  | "INVALID_KEY"
  | "AGENT_EXISTS"
  | "AGENT_NOT_FOUND"
  | "PROVIDER_NOT_FOUND"
  | "EMPTY_UPDATE"
  | "SNAPSHOT_NOT_FOUND"
  | "PROFILE_NOT_FOUND"
  | "INVALID_BODY"
  | "INTERNAL_ERROR";

export class ProfileServiceError extends Error {
  public readonly code: string;
  public readonly domainCode: DomainErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(
    code: DomainErrorCode | string,
    message: string,
    statusCode = 400,
    details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "ProfileServiceError";
    this.code = code;
    this.domainCode = code as DomainErrorCode;
    this.statusCode = statusCode;
    this.details = details;
  }
}
