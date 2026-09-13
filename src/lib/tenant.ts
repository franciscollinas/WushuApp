import { supabase } from "@/lib/supabase";

let cacheId: string | null = null;

function slugActivo(): string {
  const slug = process.env.ESCUELA_SLUG;
  if (!slug) {
    throw new Error(
      "ESCUELA_SLUG no está configurada. Define el slug de tu escuela en .env.local (ej. mantisbox)."
    );
  }
  return slug;
}

export async function getEscuelaId(): Promise<string> {
  if (cacheId) return cacheId;

  const slug = slugActivo();
  const { data, error } = await supabase
    .from("escuela")
    .select("id, activa")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error(`La escuela con slug '${slug}' no existe. Créala en la tabla escuela.`);

  const escuela = data as { id: string; activa: boolean };
  if (!escuela.activa) {
    throw new Error(`La escuela con slug '${slug}' está inactiva.`);
  }

  cacheId = escuela.id;
  return cacheId;
}

export async function getEscuela(): Promise<{ id: string; slug: string }> {
  const id = await getEscuelaId();
  return { id, slug: slugActivo() };
}