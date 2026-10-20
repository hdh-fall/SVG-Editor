import { AppError } from './AppError';

export class InvalidScaleFactorError extends AppError {
  public constructor() {
    super('scale factor must be positive');
  }
}
