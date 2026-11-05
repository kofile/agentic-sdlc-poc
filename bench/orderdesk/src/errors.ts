/** Base class for errors that map to a specific HTTP status code. */
export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.details = details;
  }
}

export class NotFoundError extends HttpError {
  constructor(resource: string, id: string | number) {
    super(404, `${resource} ${id} not found`);
  }
}

export class ValidationError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(400, message, details);
  }
}

export class ConflictError extends HttpError {
  constructor(message: string, details?: unknown) {
    super(409, message, details);
  }
}
