import { AppError } from './AppError';

export class UndoNotAllowedError extends AppError {
  public constructor() {
    super('undo not allowed after io command');
  }
}
