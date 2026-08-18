export class RetryableMessageError extends Error {
  override name = 'RetryableMessageError';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}

export class FatalMessageError extends Error {
  override name = 'FatalMessageError';

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
  }
}
