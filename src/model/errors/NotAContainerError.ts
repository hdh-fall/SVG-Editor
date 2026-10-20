import { AppError } from './AppError';

export class NotAContainerError extends AppError {
  public constructor(id: string) {
    super(`not a container: ${id}`);
  }
}
