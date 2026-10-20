import { AppError } from './AppError';

export class CannotUngroupTopLevelError extends AppError {
  public constructor(id: string) {
    super(`cannot ungroup top-level container: ${id}`);
  }
}
