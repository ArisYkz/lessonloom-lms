import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QrCodeImage({ value, size = 220 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCode.toDataURL(value, { width: size, margin: 1 }).then((url) => {
      if (active) setSrc(url);
    });
    return () => {
      active = false;
    };
  }, [value, size]);

  return src ? (
    <img src={src} alt={value} width={size} height={size} className="rounded-lg bg-white" />
  ) : (
    <div style={{ width: size, height: size }} className="rounded-lg bg-muted" />
  );
}
