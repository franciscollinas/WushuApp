"use client";

import { Copy } from "lucide-react";
import toast from "react-hot-toast";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

export interface Credenciales {
  username: string | null;
  password: string;
  alumno?: string;
}

// Muestra usuario y contraseña de un padre UNA sola vez: la contraseña no se
// guarda en texto plano, así que si se cierra sin copiar hay que restablecerla.
export default function CredencialesModal({
  credenciales,
  onCerrar,
}: {
  credenciales: Credenciales | null;
  onCerrar: () => void;
}) {
  const texto = credenciales
    ? `Mantis Box Sabanalarga\nUsuario: ${credenciales.username ?? ""}\nContraseña: ${credenciales.password}`
    : "";

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      toast.success("Datos copiados");
    } catch {
      toast.error("No se pudo copiar. Cópialos a mano.");
    }
  };

  return (
    <Modal abierto={!!credenciales} titulo="Acceso del padre" onCerrar={onCerrar}>
      {credenciales && (
        <div className="space-y-4">
          {credenciales.alumno && (
            <p className="text-sm text-tinta/70">
              Cuenta para el acudiente de <strong>{credenciales.alumno}</strong>.
            </p>
          )}
          <dl className="space-y-3 rounded-lg border border-tinta/10 bg-papel p-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-tinta/50">Usuario</dt>
              <dd className="font-mono text-base font-semibold text-tinta">
                {credenciales.username}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-tinta/50">Contraseña</dt>
              <dd className="font-mono text-base font-semibold text-tinta">
                {credenciales.password}
              </dd>
            </div>
          </dl>
          <p className="rounded-lg bg-conteo-claro p-3 text-xs text-tinta/80">
            Esta contraseña <strong>no se vuelve a mostrar</strong>. Entrégasela al padre ahora; si
            se pierde, genera una nueva desde Usuarios.
          </p>
          <div className="flex justify-end gap-3">
            <Button variant="secundario" onClick={copiar}>
              <Copy className="h-4 w-4" /> Copiar
            </Button>
            <Button onClick={onCerrar}>Listo</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
