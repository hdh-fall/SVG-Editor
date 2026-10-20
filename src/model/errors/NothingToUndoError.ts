import { AppError } from './AppError';

export class NothingToUndoError extends AppError {
  public constructor() {
    super('nothing to undo');
  }
}
