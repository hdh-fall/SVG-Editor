import { UnknownShapeTypeError } from '../model/errors';
import type { ShapeProvider } from './ShapeProvider';
import { circleProvider } from './builtin/circleProvider';
import { ellipseProvider } from './builtin/ellipseProvider';
import { gProvider } from './builtin/gProvider';
import { lineProvider } from './builtin/lineProvider';
import { rectProvider } from './builtin/rectProvider';
import { textProvider } from './builtin/textProvider';

/**
 * Dispatch point #2 of 2 (spec §2.1): type name -> provider.
 * TODO(refactor): load providers from a plugin registry instead of a hard-coded list.
 */
export class ShapeFactory {
  private readonly providers = new Map<string, ShapeProvider>();

  public register(provider: ShapeProvider): void {
    this.providers.set(provider.typeName, provider);
  }

  public has(typeName: string): boolean {
    return this.providers.has(typeName);
  }

  public providerFor(typeName: string): ShapeProvider {
    const provider = this.providers.get(typeName);
    if (provider === undefined) {
      throw new UnknownShapeTypeError(typeName);
    }
    return provider;
  }
}

export function createDefaultShapeFactory(): ShapeFactory {
  const factory = new ShapeFactory();
  const builtins: readonly ShapeProvider[] = [
    rectProvider,
    circleProvider,
    ellipseProvider,
    lineProvider,
    textProvider,
    gProvider,
  ];
  for (const provider of builtins) {
    factory.register(provider);
  }
  return factory;
}
