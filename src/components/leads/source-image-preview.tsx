import Image from "next/image";

export function SourceImagePreview({ previewUrl }: { previewUrl?: string }) {
  // Imported or History rows have no source image; an empty placeholder box is just noise.
  if (!previewUrl) return null;

  return (
    <div className="relative aspect-video overflow-hidden rounded-xl border border-border/60">
      <Image
        src={previewUrl}
        alt="Source business card"
        fill
        sizes="400px"
        className="object-contain bg-muted/40"
        unoptimized
      />
    </div>
  );
}
