export class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = "ValidationError";
    this.details = details;
    this.statusCode = 400;
  }
}

export class ExternalApiError extends Error {
  constructor(message, details = null, statusCode = 502) {
    super(message);
    this.name = "ExternalApiError";
    this.details = details;
    this.statusCode = statusCode;
  }
}
