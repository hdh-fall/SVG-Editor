import { AppError } from './AppError';

export class NothingToRedoError extends AppError {
  public constructor() {
    super('nothing to redo');
  }
}
