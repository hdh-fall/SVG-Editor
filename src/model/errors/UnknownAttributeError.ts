import { AppError } from './AppError';

export class UnknownAttributeError extends AppError {
  public constructor(attr: string) {
    super(`unknown attribute: ${attr}`);
  }
}
