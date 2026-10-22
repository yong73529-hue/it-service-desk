"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

async function compressImage(file: File) {
  if (file.type === "image/gif" || file.size < 700 * 1024) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1920 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const type = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.82));
  return blob && blob.size < file.size ? new File([blob], file.name.replace(/\.[^.]+$/, type === "image/png" ? ".png" : ".jpg"), { type, lastModified: file.lastModified }) : file;
}

export function CompressedImageInput({ id, name, maxFiles, className = "" }: { id: string; name: string; maxFiles: number; className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<{ url: string; name: string; size: number }[]>([]);
  const [working, setWorking] = useState(false);
  useEffect(() => () => previews.forEach((item) => URL.revokeObjectURL(item.url)), [previews]);
  return <div className={className}>
    <input ref={inputRef} className="input text-sm" id={id} name={name} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={working} onChange={async (event) => {
      const selected = Array.from(event.target.files || []).slice(0, maxFiles);
      setWorking(true);
      try {
        const files = await Promise.all(selected.map(compressImage));
        const transfer = new DataTransfer();
        files.forEach((file) => transfer.items.add(file));
        if (inputRef.current) inputRef.current.files = transfer.files;
        previews.forEach((item) => URL.revokeObjectURL(item.url));
        setPreviews(files.map((file) => ({ url: URL.createObjectURL(file), name: file.name, size: file.size })));
      } finally { setWorking(false); }
    }} />
    {working && <p className="mt-2 text-xs font-semibold text-[var(--accent)]">正在优化手机图片…</p>}
    {previews.length > 0 && <div className="mt-3 grid grid-cols-3 gap-2">{previews.map((item) => <div key={item.url} className="min-w-0"><Image unoptimized width={160} height={160} src={item.url} alt={item.name} className="aspect-square w-full rounded-md border object-cover"/><p className="mt-1 truncate text-[10px] text-slate-500">{Math.ceil(item.size / 1024)} KB</p></div>)}</div>}
  </div>;
}
