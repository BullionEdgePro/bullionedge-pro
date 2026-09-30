/**
 * Difference hash (dHash) for stolen-photo detection. An image is shrunk to
 * 9×8 grayscale; each bit says whether a pixel is brighter than its right-hand
 * neighbour. Re-compressed, resized or lightly edited copies of a photo land
 * within a few bits of each other. Pure: the pixel shrink happens in media.ts.
 */

export const DHASH_WIDTH = 9;
export const DHASH_HEIGHT = 8;
/** Photos within this many differing bits (of 64) are treated as the same photo. */
export const DUPLICATE_MAX_DISTANCE = 6;

/** 72 grayscale bytes (row-major, 9 wide × 8 high) → 16 hex characters. */
export function dhashFromGray(pixels: Uint8Array | readonly number[]): string {
  if (pixels.length !== DHASH_WIDTH * DHASH_HEIGHT) throw new RangeError(`Expected ${DHASH_WIDTH * DHASH_HEIGHT} pixels, got ${pixels.length}`);
  let hex = "";
  let nibble = 0;
  let bits = 0;
  for (let y = 0; y < DHASH_HEIGHT; y++) {
    for (let x = 0; x < DHASH_WIDTH - 1; x++) {
      const left = pixels[y * DHASH_WIDTH + x]!;
      const right = pixels[y * DHASH_WIDTH + x + 1]!;
      nibble = (nibble << 1) | (left > right ? 1 : 0);
      bits++;
      if (bits === 4) {
        hex += nibble.toString(16);
        nibble = 0;
        bits = 0;
      }
    }
  }
  return hex;
}

const POPCOUNT = Array.from({ length: 16 }, (_, n) => ((n >> 3) & 1) + ((n >> 2) & 1) + ((n >> 1) & 1) + (n & 1));

/** Number of differing bits between two 16-hex-character hashes. */
export function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length || !/^[0-9a-f]*$/i.test(a) || !/^[0-9a-f]*$/i.test(b)) throw new RangeError("Hashes must be hex strings of equal length");
  let d = 0;
  for (let i = 0; i < a.length; i++) d += POPCOUNT[parseInt(a[i]!, 16) ^ parseInt(b[i]!, 16)]!;
  return d;
}

export function isLikelySamePhoto(a: string, b: string): boolean {
  return hammingDistance(a, b) <= DUPLICATE_MAX_DISTANCE;
}
