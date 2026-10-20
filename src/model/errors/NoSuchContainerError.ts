import { AppError } from './AppError';

export class NoSuchContainerError extends AppError {
  public constructor(id: string) {
    super(`no such container: ${id}`);
  }
}
