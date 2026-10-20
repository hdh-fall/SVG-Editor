import { AppError } from './AppError';

export class UnknownShapeTypeError extends AppError {
  public constructor(type: string) {
    super(`unknown shape type: ${type} (is the plugin loaded?)`);
  }
}
