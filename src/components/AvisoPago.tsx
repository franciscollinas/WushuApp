"use client";

import { Bell, BellRing } from "lucide-react";
import { useEffect, useState } from "react";
import { nombreMes } from "@/lib/pagos";

export interface Recordatorio {
  mes: string; // YYYY-MM
  monto: number;
  vence: string; // YYYY-MM-DD
}

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// Recordatorio de la mensualidad del mes en curso. Aparece en el perfil desde el
// día 1 mientras no esté pagada. Si el padre activa los avisos del navegador, además
// recibe una notificación (una vez al día) cuando abre el portal.
export default function AvisoPago({ recordatorio }: { recordatorio: Recordatorio | null }) {
  // Se renderiza solo en el cliente, después de cargar los datos del portal.
  const [permiso, setPermiso] = useState<NotificationPermission | "no-soportado">(() =>
    typeof Notification === "undefined" ? "no-soportado" : Notification.permission
  );

  useEffect(() => {
    if (!recordatorio || permiso !== "granted") return;
    const clave = `aviso-pago-${recordatorio.mes}-${new Date().toISOString().slice(0, 10)}`;
    try {
      if (localStorage.getItem(clave)) return;
      localStorage.setItem(clave, "1");
    } catch {
      // Sin almacenamiento: se notifica igual, una vez por carga.
    }
    new Notification("Mantis Box · Mensualidad pendiente", {
      body: `La mensualidad de ${nombreMes(recordatorio.mes)} (${cop.format(recordatorio.monto)}) vence el día 5.`,
    });
  }, [recordatorio, permiso]);

  if (!recordatorio) return null;

  const activar = async () => {
    const resultado = await Notification.requestPermission();
    setPermiso(resultado);
  };

  return (
    <div
      role="status"
      className="flex flex-col gap-3 rounded-xl border border-dorado/50 bg-dorado/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-start gap-3">
        <BellRing className="mt-0.5 h-5 w-5 shrink-0 text-dorado" />
        <div>
          <p className="font-bold text-tinta">
            Recordatorio: mensualidad de {nombreMes(recordatorio.mes)}
          </p>
          <p className="text-tinta/70">
            Valor {cop.format(recordatorio.monto)}. Debe estar pagada antes del día 5; después de
            esa fecha el acceso se suspende hasta que el club confirme el pago.
          </p>
        </div>
      </div>
      {permiso === "default" && (
        <button
          type="button"
          onClick={activar}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-dorado/60 px-3 py-1.5 text-xs font-semibold text-tinta transition-colors hover:bg-dorado/20"
        >
          <Bell className="h-3.5 w-3.5" /> Activar avisos del navegador
        </button>
      )}
    </div>
  );
}
