/**
 * Lookups over the generated photo manifest (`src/content/images.ts`).
 *
 * Kept separate because that file is rewritten by `npm run images`.
 */
import { images, type BrandImage } from "./images";

/**
 * Throws at build time if a page references a photo that is not in
 * `brand-assets/`, so a missing file is never a blank space on the live site.
 */
export function image(id: string): BrandImage {
  const found = images.find((i) => i.id === id);
  if (!found) {
    throw new Error(`No brand photo "${id}". Put the file in brand-assets/ and run \`npm run images\`.`);
  }
  return found;
}

/** Every photo in a folder, in filename order. Empty if the owner sent none. */
export function imagesIn(folder: string): readonly BrandImage[] {
  return images.filter((i) => i.folder === folder);
}

export type { BrandImage };
