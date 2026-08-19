import { useEffect, useState } from "react";

type AuroraMoleculeProps = {
  src: string;
  alt: string;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function gradientColor(position: number) {
  const stops = [
    [79, 245, 221],
    [82, 184, 255],
    [154, 111, 255],
  ];
  const scaled = clamp(position, 0, 1) * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const mix = scaled - index;
  const from = stops[index];
  const to = stops[index + 1];
  return from.map((channel, channelIndex) => Math.round(channel + (to[channelIndex] - channel) * mix));
}

async function transparentAuroraStructure(src: string) {
  const response = await fetch(src, { mode: "cors" });
  if (!response.ok) throw new Error(`PubChem image returned ${response.status}.`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const next = new Image();
      next.onload = () => resolve(next);
      next.onerror = () => reject(new Error("Unable to decode PubChem structure image."));
      next.src = objectUrl;
    });

    const source = document.createElement("canvas");
    source.width = image.naturalWidth || image.width;
    source.height = image.naturalHeight || image.height;
    const sourceContext = source.getContext("2d", { willReadFrequently: true });
    if (!sourceContext) throw new Error("Canvas rendering is unavailable.");
    sourceContext.drawImage(image, 0, 0);

    const frame = sourceContext.getImageData(0, 0, source.width, source.height);
    const data = frame.data;
    let minX = source.width;
    let minY = source.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const offset = (y * source.width + x) * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const originalAlpha = data[offset + 3] / 255;
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        const saturation = Math.max(r, g, b) - Math.min(r, g, b);
        const distanceFromWhite = Math.max(255 - r, 255 - g, 255 - b);
        const structureStrength = Math.max(255 - luminance, saturation * 1.35, distanceFromWhite);
        const alpha = clamp((structureStrength - 7) / 44, 0, 1) * originalAlpha;

        if (alpha < 0.035) {
          data[offset + 3] = 0;
          continue;
        }

        const [nextR, nextG, nextB] = gradientColor(x / Math.max(1, source.width - 1));
        data[offset] = nextR;
        data[offset + 1] = nextG;
        data[offset + 2] = nextB;
        data[offset + 3] = Math.round(255 * Math.pow(alpha, 0.72));
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }

    if (maxX < minX || maxY < minY) throw new Error("No molecular structure pixels were detected.");
    sourceContext.putImageData(frame, 0, 0);

    const padding = Math.max(18, Math.round(Math.min(source.width, source.height) * 0.045));
    const cropX = Math.max(0, minX - padding);
    const cropY = Math.max(0, minY - padding);
    const cropWidth = Math.min(source.width - cropX, maxX - minX + 1 + padding * 2);
    const cropHeight = Math.min(source.height - cropY, maxY - minY + 1 + padding * 2);
    const output = document.createElement("canvas");
    output.width = cropWidth;
    output.height = cropHeight;
    const outputContext = output.getContext("2d");
    if (!outputContext) throw new Error("Canvas rendering is unavailable.");
    outputContext.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    return output.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export function AuroraMolecule({ src, alt }: AuroraMoleculeProps) {
  const [processedSrc, setProcessedSrc] = useState<string | null>(null);
  const [processingFailed, setProcessingFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setProcessedSrc(null);
    setProcessingFailed(false);

    void transparentAuroraStructure(src)
      .then((value) => {
        if (!cancelled) setProcessedSrc(value);
      })
      .catch(() => {
        if (!cancelled) setProcessingFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <div className="rh-molecule-image-wrap" data-transparent-molecule="true">
      {processedSrc ? (
        <img src={processedSrc} alt={alt} className="rh-molecule-image" />
      ) : processingFailed ? (
        <img
          src={src}
          alt={alt}
          className="rh-molecule-image"
          style={{ filter: "invert(1) grayscale(1) contrast(1.7) brightness(1.18) drop-shadow(0 0 14px rgba(95,235,244,.45)) drop-shadow(0 0 36px rgba(125,92,255,.30))", mixBlendMode: "screen" }}
        />
      ) : (
        <div className="rh-molecule-rendering" aria-label="Rendering transparent molecular structure" />
      )}
    </div>
  );
}
