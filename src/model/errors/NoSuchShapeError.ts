import { AppError } from './AppError';

export class NoSuchShapeError extends AppError {
  public constructor(id: string) {
    super(`no such shape: ${id}`);
  }
}
