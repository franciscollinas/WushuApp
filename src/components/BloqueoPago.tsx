import { Lock } from "lucide-react";
import { nombreMes } from "@/lib/pagos";

const cop = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

// Pantalla que ve el padre cuando su hijo no está al día (desde el día 5). No
// muestra datos del alumno más allá de su nombre.
export default function BloqueoPago({
  nombre,
  monto,
  mes,
  razon = "pago",
}: {
  nombre: string;
  monto: number;
  mes: string;
  razon?: "pago" | "club" | null;
}) {
  return (
    <div className="mx-auto max-w-xl rounded-2xl border border-rojo/30 bg-papel-claro p-8 text-center shadow-md">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rojo/10 text-rojo">
        <Lock className="h-8 w-8" />
      </div>
      <h2 className="text-xl font-bold text-tinta">Acceso suspendido</h2>
      {razon === "club" ? (
        <p className="mt-3 text-sm leading-relaxed text-tinta/70">
          El club suspendió el acceso de <strong>{nombre}</strong>. Comunícate con{" "}
          <strong>Mantis Box Sabanalarga</strong> para reactivarlo.
        </p>
      ) : (
        <>
          <p className="mt-3 text-sm leading-relaxed text-tinta/70">
            La mensualidad de <strong>{nombreMes(mes)}</strong> de <strong>{nombre}</strong> está
            pendiente
            {monto > 0 ? (
              <>
                {" "}
                por <strong>{cop.format(monto)}</strong>
              </>
            ) : null}
            .
          </p>
          <p className="mt-3 text-sm leading-relaxed text-tinta/70">
            Comunícate con <strong>Mantis Box Sabanalarga</strong> para ponerte al día. Cuando el
            club confirme tu pago, el acceso se restablece automáticamente.
          </p>
        </>
      )}
    </div>
  );
}
