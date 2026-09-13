import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import type {
  DeudaRow,
  DeudaConTotales,
  DeudaAlumnoConDetalle,
  DeudaAlumnoPagoRow,
} from "@/types/supabase";

export const deudaRouter = router({
  // Lista general de deudas para el Admin con totales calculados
  list: adminProcedure.query(async (): Promise<DeudaConTotales[]> => {
    const escuelaId = await getEscuelaId();

    const { data: deudas, error: errorDeudas } = await supabase
      .from("deuda")
      .select("*")
      .eq("escuela_id", escuelaId)
      .order("created_at", { ascending: false });

    if (errorDeudas) throw new Error(errorDeudas.message);
    if (!deudas || deudas.length === 0) return [];

    // Obtenemos las asignaciones de todas las deudas de la escuela
    const { data: asignaciones, error: errorAsig } = await supabase
      .from("deuda_alumno")
      .select("deuda_id, monto_total, monto_pagado")
      .eq("escuela_id", escuelaId);

    if (errorAsig) throw new Error(errorAsig.message);

    const deudasConTotales: DeudaConTotales[] = deudas.map((d: DeudaRow) => {
      const items = (asignaciones ?? []).filter((a) => a.deuda_id === d.id);
      const total_asignado = items.reduce((acc, curr) => acc + Number(curr.monto_total || 0), 0);
      const total_pagado = items.reduce((acc, curr) => acc + Number(curr.monto_pagado || 0), 0);
      return {
        ...d,
        total_asignado,
        total_pagado,
        alumnos_count: items.length,
      };
    });

    return deudasConTotales;
  }),

  // Detalle de una deuda específica con sus alumnos y abonos
  getById: adminProcedure
    .input(z.string().min(1))
    .query(async ({ input }): Promise<{ deuda: DeudaRow; alumnos: DeudaAlumnoConDetalle[] }> => {
      const escuelaId = await getEscuelaId();

      const { data: deuda, error: errDeuda } = await supabase
        .from("deuda")
        .select("*")
        .eq("escuela_id", escuelaId)
        .eq("id", input)
        .single();

      if (errDeuda || !deuda) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Deuda no encontrada",
        });
      }

      // Obtener asignaciones con datos del alumno
      const { data: asignaciones, error: errAsig } = await supabase
        .from("deuda_alumno")
        .select("*, alumno(*)")
        .eq("escuela_id", escuelaId)
        .eq("deuda_id", input)
        .order("created_at", { ascending: true });

      if (errAsig) throw new Error(errAsig.message);

      // Obtener pagos
      const asigIds = (asignaciones ?? []).map((a) => a.id);
      let pagos: DeudaAlumnoPagoRow[] = [];
      if (asigIds.length > 0) {
        const { data: pagosData, error: errPagos } = await supabase
          .from("deuda_alumno_pago")
          .select("*")
          .eq("escuela_id", escuelaId)
          .in("deuda_alumno_id", asigIds)
          .order("fecha", { ascending: false });

        if (errPagos) throw new Error(errPagos.message);
        pagos = (pagosData ?? []) as DeudaAlumnoPagoRow[];
      }

      const alumnosConDetalle: DeudaAlumnoConDetalle[] = (asignaciones ?? []).map((item) => ({
        ...item,
        pagos: pagos.filter((p) => p.deuda_alumno_id === item.id),
      }));

      return {
        deuda: deuda as DeudaRow,
        alumnos: alumnosConDetalle,
      };
    }),

  // Crear un nuevo evento/deuda general
  create: adminProcedure
    .input(
      z.object({
        nombre: z.string().min(1, "El nombre es obligatorio"),
        descripcion: z.string().optional(),
      })
    )
    .mutation(async ({ input }): Promise<DeudaRow> => {
      const escuelaId = await getEscuelaId();

      const { data, error } = await supabase
        .from("deuda")
        .insert({
          escuela_id: escuelaId,
          nombre: input.nombre.trim(),
          descripcion: input.descripcion?.trim() || null,
        })
        .select()
        .single();

      if (error) throw new Error(error.message);
      return data as DeudaRow;
    }),

  // Eliminar deuda general
  delete: adminProcedure.input(z.string().min(1)).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { error } = await supabase
      .from("deuda")
      .delete()
      .eq("escuela_id", escuelaId)
      .eq("id", input);

    if (error) throw new Error(error.message);
    return { success: true };
  }),

  // Asignar alumno a una deuda con monto individual
  asignarAlumno: adminProcedure
    .input(
      z.object({
        deuda_id: z.string().min(1),
        alumno_id: z.string().min(1),
        monto_total: z.number().positive("El monto debe ser mayor a 0"),
      })
    )
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();

      const { data, error } = await supabase
        .from("deuda_alumno")
        .insert({
          escuela_id: escuelaId,
          deuda_id: input.deuda_id,
          alumno_id: input.alumno_id,
          monto_total: input.monto_total,
          monto_pagado: 0,
          estado: "pendiente",
        })
        .select("*, alumno(*)")
        .single();

      if (error) {
        if (error.code === "23505") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Este alumno ya está asignado a esta deuda.",
          });
        }
        throw new Error(error.message);
      }

      return data;
    }),

  // Eliminar asignación de alumno
  eliminarAsignacion: adminProcedure
    .input(z.string().min(1))
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { error } = await supabase
        .from("deuda_alumno")
        .delete()
        .eq("escuela_id", escuelaId)
        .eq("id", input);

      if (error) throw new Error(error.message);
      return { success: true };
    }),

  // Registrar abono de pago a la deuda del alumno
  abonar: adminProcedure
    .input(
      z.object({
        deuda_alumno_id: z.string().min(1),
        monto: z.number().positive("El monto abonado debe ser mayor a 0"),
        fecha: z.string().optional(),
        nota: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();

      // Consultar deuda_alumno actual
      const { data: item, error: fetchErr } = await supabase
        .from("deuda_alumno")
        .select("*")
        .eq("escuela_id", escuelaId)
        .eq("id", input.deuda_alumno_id)
        .single();

      if (fetchErr || !item) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No se encontró el registro de deuda del alumno.",
        });
      }

      const montoActual = Number(item.monto_pagado || 0);
      const montoTotal = Number(item.monto_total || 0);
      const nuevoPagado = montoActual + input.monto;
      const nuevoEstado =
        nuevoPagado >= montoTotal ? "pagado" : nuevoPagado > 0 ? "parcial" : "pendiente";

      // Registrar el pago
      const { error: errorPago } = await supabase.from("deuda_alumno_pago").insert({
        escuela_id: escuelaId,
        deuda_alumno_id: input.deuda_alumno_id,
        monto: input.monto,
        fecha: input.fecha || new Date().toISOString().split("T")[0],
        nota: input.nota?.trim() || null,
      });

      if (errorPago) throw new Error(errorPago.message);

      // Actualizar monto_pagado y estado en deuda_alumno
      const { data: updated, error: errorUpdate } = await supabase
        .from("deuda_alumno")
        .update({
          monto_pagado: nuevoPagado,
          estado: nuevoEstado,
        })
        .eq("escuela_id", escuelaId)
        .eq("id", input.deuda_alumno_id)
        .select()
        .single();

      if (errorUpdate) throw new Error(errorUpdate.message);

      return updated;
    }),

  // Procedimiento para el padre: listar todas las deudas activas/concluidas de su hijo
  misDeudas: protectedProcedure
    .input(z.object({ alumno_id: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const escuelaId = await getEscuelaId();
      let targetAlumnoIds: string[] = [];

      if (ctx.usuario.rol === "padre") {
        // Buscar los alumnos vinculados a este usuario
        const { data: vinculos, error: vinculosErr } = await supabase
          .from("alumno_padre")
          .select("alumno_id")
          .eq("escuela_id", escuelaId)
          .eq("usuario_id", ctx.user.id);

        if (vinculosErr) throw new Error(vinculosErr.message);
        targetAlumnoIds = (vinculos ?? []).map((v) => v.alumno_id);
      } else if (input?.alumno_id) {
        targetAlumnoIds = [input.alumno_id];
      }

      if (targetAlumnoIds.length === 0) {
        return [];
      }

      const { data: deudasAlumno, error: err } = await supabase
        .from("deuda_alumno")
        .select("*, deuda(*), alumno(*)")
        .eq("escuela_id", escuelaId)
        .in("alumno_id", targetAlumnoIds)
        .order("created_at", { ascending: false });

      if (err) throw new Error(err.message);
      if (!deudasAlumno || deudasAlumno.length === 0) return [];

      const asigIds = deudasAlumno.map((d) => d.id);
      const { data: pagosData } = await supabase
        .from("deuda_alumno_pago")
        .select("*")
        .eq("escuela_id", escuelaId)
        .in("deuda_alumno_id", asigIds)
        .order("fecha", { ascending: false });

      const pagos = pagosData ?? [];

      return deudasAlumno.map((da) => ({
        ...da,
        pagos: pagos.filter((p) => p.deuda_alumno_id === da.id),
      }));
    }),
});
