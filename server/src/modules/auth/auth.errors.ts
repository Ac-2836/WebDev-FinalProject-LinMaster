export class AuthEmailAlreadyExistsError extends Error {
  constructor() {
    super('Email already registered.');
    this.name = 'AuthEmailAlreadyExistsError';
  }
}
