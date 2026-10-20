import { AppError } from './AppError';

export class DuplicateIdError extends AppError {
  public constructor(id: string) {
    super(`id already exists: ${id}`);
  }
}
