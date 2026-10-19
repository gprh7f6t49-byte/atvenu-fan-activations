"use client";

import { useEffect, useState } from "react";

/**
 * Image upload with a live preview. Leaving it empty keeps the current image;
 * "Remove" clears it on save. The file goes to the server with the rest of the form.
 */
export function ImageField({ name, label, current, hint, aspect = "aspect-[3/1]" }: {
  name: string; label: string; current?: string | null; hint?: string; aspect?: string;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const shown = preview ?? (removed ? null : current ?? null);
  return (
    <div className="block">
      <span className="label">{label}</span>
      <div className={`relative ${aspect} w-full overflow-hidden rounded-lg border border-dashed border-zinc-300 bg-zinc-50`}>
        {shown ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={shown} alt="" className="h-full w-full object-cover" />
        ) : (
          <span className="absolute inset-0 grid place-items-center text-xs text-zinc-400">No image — brand colours are used</span>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
        <input
          type="file"
          name={name}
          accept="image/jpeg,image/png,image/webp"
          className="block max-w-full text-sm"
          onChange={(e) => {
            const f = e.currentTarget.files?.[0];
            setError(null);
            if (preview) URL.revokeObjectURL(preview);
            if (f && f.size > 10 * 1024 * 1024) {
              setError("Images must be 10 MB or smaller");
              e.currentTarget.value = "";
              setPreview(null);
              return;
            }
            setPreview(f ? URL.createObjectURL(f) : null);
            if (f) setRemoved(false);
          }}
        />
        {current && !preview && (
          <label className="flex items-center gap-1.5 text-xs text-zinc-600">
            <input type="checkbox" name={`${name}_remove`} value="1" checked={removed} onChange={(e) => setRemoved(e.currentTarget.checked)} />
            Remove image
          </label>
        )}
      </div>
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
      {hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}
    </div>
  );
}
