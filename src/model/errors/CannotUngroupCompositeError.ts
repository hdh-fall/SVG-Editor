import { AppError } from './AppError';

export class CannotUngroupCompositeError extends AppError {
  public constructor(id: string) {
    super(`cannot ungroup composite shape: ${id}`);
  }
}
