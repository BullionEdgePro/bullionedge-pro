import Image from "next/image";
import { Emblem } from "@/components/brand/logo";
import { cn } from "@/lib/cn";

/**
 * A stored photo (/api/media/…), filling its box. Public photos go through the
 * image optimiser for phone-sized variants; private ones (drafts, evidence)
 * load directly so the viewer's session applies. With no photo, a velvet
 * plate with the emblem stands in: never a stock image.
 */
export function MediaImage({
  src,
  alt,
  sizes = "(min-width: 1024px) 25vw, (min-width: 640px) 45vw, 90vw",
  priority = false,
  isPrivate = false,
  className,
  imgClassName,
}: {
  src: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  isPrivate?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-surface-sunk", className)}>
      {src ? (
        <Image src={src} alt={alt} fill sizes={sizes} priority={priority} unoptimized={isPrivate} className={cn("object-cover", imgClassName)} />
      ) : (
        <div
          role="img"
          aria-label={`${alt}: no photo`}
          className="absolute inset-0 grid place-items-center bg-[radial-gradient(120%_90%_at_30%_20%,#2c2140_0%,#1b1326_60%,#140e1b_100%)] text-champagne/25"
        >
          <Emblem detail="mono" title="" className="w-1/4 max-w-20" />
        </div>
      )}
    </div>
  );
}
