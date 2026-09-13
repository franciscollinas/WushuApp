"use client";

import { Plus, X } from "lucide-react";
import type { CriterioEval } from "@/types/supabase";

const NOTAS = [
  { valor: 1, etiqueta: "1" },
  { valor: 2, etiqueta: "2" },
  { valor: 3, etiqueta: "3" },
  { valor: 4, etiqueta: "4" },
  { valor: 5, etiqueta: "5" },
];

export default function CriteriosEditor({
  titulo,
  criterios,
  onChange,
}: {
  titulo: string;
  criterios: CriterioEval[];
  onChange: (criterios: CriterioEval[]) => void;
}) {
  const actualizar = (idx: number, campo: keyof CriterioEval, valor: string | number) => {
    const copia = [...criterios];
    copia[idx] = { ...copia[idx], [campo]: valor };
    onChange(copia);
  };

  return (
    <div className="rounded-lg border border-tinta/10 bg-papel p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold text-tinta">{titulo}</h3>
        <button
          type="button"
          onClick={() => onChange([...criterios, { nombre: "", nota: 3 }])}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-mantis transition-colors hover:bg-mantis-light/40"
        >
          <Plus className="h-3.5 w-3.5" /> Añadir
        </button>
      </div>

      {criterios.length === 0 && (
        <p className="py-1 text-xs text-tinta/40">Sin criterios todavía</p>
      )}

      <div className="flex flex-col gap-2">
        {criterios.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={c.nombre}
              onChange={(e) => actualizar(i, "nombre", e.target.value)}
              placeholder="Criterio (ej. Mae geri)"
              className="flex-1 rounded-lg border border-tinta/15 bg-papel-claro px-2.5 py-1.5 text-sm text-tinta outline-none focus:border-mantis"
            />
            <select
              value={c.nota}
              onChange={(e) => actualizar(i, "nota", Number(e.target.value))}
              className="w-16 rounded-lg border border-tinta/15 bg-papel-claro px-2 py-1.5 text-sm text-tinta outline-none focus:border-mantis"
            >
              {NOTAS.map((n) => (
                <option key={n.valor} value={n.valor}>
                  {n.etiqueta}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => onChange(criterios.filter((_, x) => x !== i))}
              className="rounded-lg p-1.5 text-tinta/40 transition-colors hover:bg-papel hover:text-falta"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}