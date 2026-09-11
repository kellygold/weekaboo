export type ServiceErrorCode = 'authentication' | 'forbidden' | 'not-found' | 'conflict' | 'validation' | 'rate-limit' | 'unavailable' | 'uncertain' | 'unsupported';

export class ServiceError extends Error {
  constructor(public readonly code: ServiceErrorCode, message: string, public readonly status?: number) {
    super(message);
    this.name = 'ServiceError';
  }
}
