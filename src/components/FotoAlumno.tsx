"use client";

import { useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import toast from "react-hot-toast";
import { trpc } from "@/lib/trpc";
import { browserSupabase } from "@/lib/supabase-browser";

const LADO = 600;

// Reduce y recorta la foto a un cuadrado JPEG de 600 px: sube rápido y pesa poco.
async function prepararImagen(archivo: File): Promise<Blob> {
  const bmp = await createImageBitmap(archivo);
  const lado = Math.min(bmp.width, bmp.height);
  const tam = Math.min(LADO, lado);
  const canvas = document.createElement("canvas");
  canvas.width = tam;
  canvas.height = tam;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo procesar la imagen.");
  ctx.drawImage(bmp, (bmp.width - lado) / 2, (bmp.height - lado) / 2, lado, lado, 0, 0, tam, tam);
  return new Promise((ok, fallo) =>
    canvas.toBlob((b) => (b ? ok(b) : fallo(new Error("No se pudo procesar la imagen."))), "image/jpeg", 0.85)
  );
}

interface Props {
  alumnoId: string;
  nombre: string;
  fotoUrl: string | null | undefined;
  fondo: string;
  color: string;
  onCambio: () => void;
  className?: string;
}

export default function FotoAlumno({
  alumnoId,
  nombre,
  fotoUrl,
  fondo,
  color,
  onCambio,
  className = "h-16 w-16",
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const urlSubida = trpc.foto.urlSubida.useMutation();
  const guardar = trpc.foto.guardar.useMutation();

  const elegir = async (archivo: File | undefined) => {
    if (!archivo) return;
    if (!archivo.type.startsWith("image/")) {
      toast.error("Elige una imagen (JPG, PNG o WebP).");
      return;
    }
    setSubiendo(true);
    try {
      const blob = await prepararImagen(archivo);
      const { path, token } = await urlSubida.mutateAsync({ alumno_id: alumnoId });
      const { error } = await browserSupabase()
        .storage.from("fotos-alumnos")
        .uploadToSignedUrl(path, token, blob, { contentType: "image/jpeg" });
      if (error) throw new Error(error.message);
      await guardar.mutateAsync({ alumno_id: alumnoId, path });
      toast.success("Foto actualizada");
      onCambio();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo subir la foto.");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className={`relative shrink-0 ${className}`}>
      <div
        className="flex h-full w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-tinta/20 text-2xl font-bold shadow-inner"
        style={{ backgroundColor: fondo, color }}
      >
        {fotoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={fotoUrl} alt={`Foto de ${nombre}`} className="h-full w-full object-cover" />
        ) : (
          "武"
        )}
      </div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        disabled={subiendo}
        aria-label={fotoUrl ? "Elegir otra foto de la galería" : "Elegir foto de la galería"}
        title={fotoUrl ? "Elegir otra foto de la galería" : "Elegir foto de la galería"}
        className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-papel-claro bg-mantis text-papel shadow transition-colors hover:bg-mantis-dark disabled:opacity-60"
      >
        <ImagePlus className="h-3.5 w-3.5" />
      </button>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => elegir(e.target.files?.[0])}
      />
    </div>
  );
}
