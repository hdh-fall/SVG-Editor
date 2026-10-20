import { AppError } from './AppError';

export class CannotGroupIntoDescendantError extends AppError {
  public constructor(id: string) {
    super(`cannot group a container into its own descendant: ${id}`);
  }
}
