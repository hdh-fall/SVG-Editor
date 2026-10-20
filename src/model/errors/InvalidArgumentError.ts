import { AppError } from './AppError';

export class InvalidArgumentError extends AppError {
  public constructor(detail: string) {
    super(`invalid argument: ${detail}`);
  }
}
