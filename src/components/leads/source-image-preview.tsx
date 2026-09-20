import Image from "next/image";
import { ImageOff } from "lucide-react";

export function SourceImagePreview({ previewUrl }: { previewUrl?: string }) {
  if (!previewUrl) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-border bg-muted/40 text-muted-foreground">
        <ImageOff className="size-6" />
      </div>
    );
  }

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
