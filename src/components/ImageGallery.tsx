"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function ImageGallery({ images, compact = false }: { images: { id: string; name: string; url: string }[]; compact?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  useEffect(() => {
    if (active === null) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setActive(null); if (event.key === "ArrowLeft") setActive((value) => value === null ? null : (value + images.length - 1) % images.length); if (event.key === "ArrowRight") setActive((value) => value === null ? null : (value + 1) % images.length); };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [active, images.length]);
  if (!images.length) return null;
  return <>
    <div className={`grid gap-2 ${compact ? (images.length > 1 ? "grid-cols-2" : "grid-cols-1") : "grid-cols-2 sm:grid-cols-3"}`}>
      {images.map((image, index) => <button type="button" key={image.id} onClick={() => setActive(index)} className={`relative overflow-hidden rounded-lg border bg-white ${compact ? "aspect-video min-w-40" : "aspect-video"}`} aria-label={`查看图片 ${image.name}`}><Image src={image.url} alt={image.name} fill className="object-cover" /></button>)}
    </div>
    {active !== null && <div role="dialog" aria-modal="true" aria-label="图片预览" className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setActive(null)}><button type="button" onClick={() => setActive(null)} aria-label="关闭预览" className="absolute right-4 top-4 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white"><X /></button>{images.length > 1 && <button type="button" onClick={(event) => { event.stopPropagation(); setActive((active + images.length - 1) % images.length); }} aria-label="上一张" className="absolute left-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white"><ChevronLeft /></button>}<div className="relative h-[80vh] w-[86vw]" onClick={(event) => event.stopPropagation()}><Image src={images[active].url} alt={images[active].name} fill sizes="90vw" className="object-contain" /></div>{images.length > 1 && <button type="button" onClick={(event) => { event.stopPropagation(); setActive((active + 1) % images.length); }} aria-label="下一张" className="absolute right-3 grid h-11 w-11 place-items-center rounded-full bg-white/10 text-white"><ChevronRight /></button>}<p className="absolute bottom-4 text-sm text-white/80">{active + 1} / {images.length}</p></div>}
  </>;
}
