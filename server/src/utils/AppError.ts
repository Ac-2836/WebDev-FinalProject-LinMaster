const STATUS_BY_CODE: Record<number, string> = {
  400: 'INVALID_ARGUMENT',
  401: 'UNAUTHENTICATED',
  403: 'PERMISSION_DENIED',
  404: 'NOT_FOUND',
  409: 'FAILED_PRECONDITION',
  429: 'RESOURCE_EXHAUSTED',
  500: 'INTERNAL',
};

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly status: string;
  public readonly details?: unknown;
  public readonly isOperational = true;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.status = STATUS_BY_CODE[statusCode] ?? 'INTERNAL';
    this.details = details;

    Object.setPrototypeOf(this, new.target.prototype);
  }
}