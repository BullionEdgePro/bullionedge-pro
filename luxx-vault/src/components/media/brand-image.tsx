import { cn } from "@/lib/cn";
import { image } from "@/content/brand-images";

interface BrandImageProps {
  /** Manifest id, e.g. `"team/team-portrait"`. */
  id: string;
  /** What the photo shows, for people using a screen reader. Empty if decorative. */
  alt: string;
  /** Widths the photo is drawn at, for the browser to pick a file size. */
  sizes: string;
  className?: string;
  /** Load immediately instead of when it scrolls near. Use for the first photo only. */
  priority?: boolean;
  /** Which part of the photo to keep when it is cropped, e.g. `"center 18%"`. */
  focus?: string;
}

/**
 * A photo from `brand-assets/`, served as AVIF with a WebP fallback.
 *
 * The blurred placeholder sits behind the image, so the space is filled with
 * the photo's own colours while it loads instead of flashing empty. The
 * aspect ratio comes from the file, so nothing on the page shifts.
 */
export function BrandImage({ id, alt, sizes, className, priority = false, focus }: BrandImageProps) {
  const img = image(id);
  return (
    <picture>
      <source type="image/avif" srcSet={img.sources.avif.join(", ")} sizes={sizes} />
      <source type="image/webp" srcSet={img.sources.webp.join(", ")} sizes={sizes} />
      <img
        src={img.src}
        alt={alt}
        width={img.width}
        height={img.height}
        sizes={sizes}
        loading={priority ? "eager" : "lazy"}
        fetchPriority={priority ? "high" : "auto"}
        decoding="async"
        className={cn("h-full w-full object-cover", className)}
        style={{
          objectPosition: focus,
          backgroundImage: `url("${img.blurDataURL}")`,
          backgroundSize: "cover",
          backgroundPosition: focus ?? "center",
        }}
      />
    </picture>
  );
}
