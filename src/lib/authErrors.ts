export class AuthCredentialsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthCredentialsError";
  }
}

export class AuthServerError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthServerError";
    this.status = status;
  }
}

export class AuthResponseError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthResponseError";
    this.status = status;
  }
}

export const authErrorForStatus = (status: number, message: string): Error | null => {
  if (status === 401 || status === 403) return new AuthCredentialsError(message);
  if (status >= 500) return new AuthServerError(status, message);
  if (status < 200 || status >= 300) return new AuthResponseError(status, message);
  return null;
};
