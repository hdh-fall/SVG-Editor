import { AppError } from './AppError';

export class FileError extends AppError {
  public static read(file: string): FileError {
    return new FileError(`cannot read file: ${file}`);
  }

  public static write(file: string): FileError {
    return new FileError(`cannot write file: ${file}`);
  }
}
