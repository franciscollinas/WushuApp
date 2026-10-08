import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hoyColombia } from "@/lib/padres";
import { alumnoAlDia, nombreMes } from "@/lib/pagos";
import { sinCinta } from "@/lib/cinta";
import { protectedProcedure, staffProcedure, adminProcedure, router } from "../trpc";
import type { PagoConAlumno } from "@/types/supabase";

const SELECT_PAGO = "*, alumno(*), abonos:pago_abono(id, monto, fecha_pago, metodo_pago, comprobante_numero)";

const cop = (n: number) => `$${Math.round(n).toLocaleString("es-CO")}`;
const dosDigitos = (n: number) => String(n).padStart(2, "0");

export const pagoRouter = router({
  list: staffProcedure.query(async (): Promise<PagoConAlumno[]> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("pago")
      .select(SELECT_PAGO)
      .eq("escuela_id", escuelaId)
      .order("fecha_vencimiento", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PagoConAlumno[];
  }),

  listByMes: staffProcedure.input(z.string()).query(async ({ input }): Promise<PagoConAlumno[]> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("pago")
      .select(SELECT_PAGO)
      .eq("escuela_id", escuelaId)
      .eq("mes", input)
      .order("fecha_vencimiento");
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as PagoConAlumno[];
  }),

  // Registra un pago recibido de un alumno para un mes. Si el mes aún no tiene cobro
  // se crea con el valor de la mensualidad; el pago puede ser parcial (abono) y el
  // mes queda 'pagado' al completar el valor. Cada pago genera su comprobante.
  registrarPago: adminProcedure
    .input(
      z.object({
        alumno_id: z.string().min(1),
        mes: z.string().regex(/^\d{4}-\d{2}$/),
        monto: z.number().positive("El valor debe ser mayor a 0"),
        fecha_pago: z.string().optional(),
        metodo_pago: z.string().trim().max(40).optional(),
        observaciones: z.string().trim().max(300).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();

      const { data: alumno } = await supabase
        .from("alumno")
        .select("id, nombre, modalidad_pago, grupo(dia_limite_pago)")
        .eq("escuela_id", escuelaId)
        .eq("id", input.alumno_id)
        .maybeSingle();
      if (!alumno) throw new TRPCError({ code: "NOT_FOUND", message: "Alumno no encontrado." });
      if (alumno.modalidad_pago === "becado") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `${alumno.nombre} es becado: no tiene mensualidad que pagar.`,
        });
      }

      let { data: pago } = await supabase
        .from("pago")
        .select("id, monto, monto_pagado")
        .eq("escuela_id", escuelaId)
        .eq("alumno_id", input.alumno_id)
        .eq("mes", input.mes)
        .maybeSingle();

      if (!pago) {
        const { data: escuela } = await supabase
          .from("escuela")
          .select("mensualidad_monto")
          .eq("id", escuelaId)
          .maybeSingle();
        const valorMes = Number(escuela?.mensualidad_monto ?? 0);
        if (valorMes <= 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Define primero el valor de la mensualidad." });
        }
        const g = Array.isArray(alumno.grupo) ? alumno.grupo[0] : alumno.grupo;
        const limite = Number((g as { dia_limite_pago?: number } | null)?.dia_limite_pago ?? 5);
        const { data: creado, error: errCrear } = await supabase
          .from("pago")
          .insert({
            escuela_id: escuelaId,
            alumno_id: input.alumno_id,
            mes: input.mes,
            monto: valorMes,
            estado: "pendiente",
            fecha_vencimiento: `${input.mes}-${dosDigitos(limite)}`,
          })
          .select("id, monto, monto_pagado")
          .single();
        if (errCrear) throw new Error(errCrear.message);
        pago = creado;
      }

      const saldo = Number(pago!.monto) - Number(pago!.monto_pagado ?? 0);
      if (input.monto > saldo + 0.001) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `El valor supera lo que falta de ${nombreMes(input.mes)} (${cop(saldo)}).`,
        });
      }

      const { data: abono, error } = await supabase
        .from("pago_abono")
        .insert({
          escuela_id: escuelaId,
          pago_id: pago!.id,
          monto: input.monto,
          fecha_pago: input.fecha_pago ?? hoyColombia(),
          metodo_pago: input.metodo_pago || null,
          observaciones: input.observaciones || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { abonoId: abono.id as string, pagoId: pago!.id as string };
    }),

  // Abona a un cobro que ya existe (botón "Registrar pago" de cada fila).
  registrarAbono: adminProcedure
    .input(
      z.object({
        pago_id: z.string().min(1),
        monto: z.number().positive("El valor debe ser mayor a 0"),
        fecha_pago: z.string().optional(),
        metodo_pago: z.string().trim().max(40).optional(),
        observaciones: z.string().trim().max(300).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { data: pago } = await supabase
        .from("pago")
        .select("id, mes, monto, monto_pagado")
        .eq("escuela_id", escuelaId)
        .eq("id", input.pago_id)
        .maybeSingle();
      if (!pago) throw new TRPCError({ code: "NOT_FOUND", message: "Cobro no encontrado." });

      const saldo = Number(pago.monto) - Number(pago.monto_pagado ?? 0);
      if (saldo <= 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Este mes ya está pagado completo." });
      }
      if (input.monto > saldo + 0.001) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `El valor supera lo que falta (${cop(saldo)}).`,
        });
      }

      const { data: abono, error } = await supabase
        .from("pago_abono")
        .insert({
          escuela_id: escuelaId,
          pago_id: input.pago_id,
          monto: input.monto,
          fecha_pago: input.fecha_pago ?? hoyColombia(),
          metodo_pago: input.metodo_pago || null,
          observaciones: input.observaciones || null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      return { abonoId: abono.id as string };
    }),

  // Corrige un error: borra un abono (el estado del mes se recalcula solo).
  eliminarAbono: adminProcedure.input(z.string().min(1)).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { error } = await supabase
      .from("pago_abono")
      .delete()
      .eq("escuela_id", escuelaId)
      .eq("id", input);
    if (error) throw new Error(error.message);
    return { success: true };
  }),

  delete: adminProcedure.input(z.string()).mutation(async ({ input }) => {
    const escuelaId = await getEscuelaId();
    const { error } = await supabase
      .from("pago")
      .delete()
      .eq("escuela_id", escuelaId)
      .eq("id", input);
    if (error) throw new Error(error.message);
    return { success: true };
  }),

  // Valor único de la mensualidad del club.
  config: adminProcedure.query(async () => {
    const escuelaId = await getEscuelaId();
    const { data } = await supabase
      .from("escuela")
      .select("mensualidad_monto")
      .eq("id", escuelaId)
      .maybeSingle();
    return { mensualidad_monto: Number(data?.mensualidad_monto ?? 0) };
  }),

  setMensualidad: adminProcedure
    .input(z.object({ monto: z.number().min(0).max(100_000_000) }))
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { error } = await supabaseAdmin()
        .from("escuela")
        .update({ mensualidad_monto: input.monto })
        .eq("id", escuelaId);
      if (error) throw new Error(error.message);
      return { success: true };
    }),

  // Crea el cobro pendiente del mes para cada alumno activo que no sea becado y aún
  // no lo tenga. El bloqueo no depende de esto: sirve para ver quién debe y recordar.
  generarMes: adminProcedure
    .input(z.object({ mes: z.string().regex(/^\d{4}-\d{2}$/) }))
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { data: escuela } = await supabase
        .from("escuela")
        .select("mensualidad_monto")
        .eq("id", escuelaId)
        .maybeSingle();
      const monto = Number(escuela?.mensualidad_monto ?? 0);
      if (monto <= 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Define primero el valor de la mensualidad.",
        });
      }

      const { data: alumnos, error: errAl } = await supabase
        .from("alumno")
        .select("id, fecha_ingreso, created_at, grupo(dia_limite_pago)")
        .eq("escuela_id", escuelaId)
        .eq("estado", "activo")
        .neq("modalidad_pago", "becado");
      if (errAl) throw new Error(errAl.message);

      const { data: existentes, error: errEx } = await supabase
        .from("pago")
        .select("alumno_id")
        .eq("escuela_id", escuelaId)
        .eq("mes", input.mes);
      if (errEx) throw new Error(errEx.message);
      const conPago = new Set((existentes ?? []).map((p) => p.alumno_id as string));

      const filas = (alumnos ?? [])
        .filter((a) => !conPago.has(a.id as string))
        .filter((a) => String(a.fecha_ingreso ?? a.created_at).slice(0, 7) <= input.mes)
        .map((a) => {
          const g = Array.isArray(a.grupo) ? a.grupo[0] : a.grupo;
          const limite = Number((g as { dia_limite_pago?: number } | null)?.dia_limite_pago ?? 5);
          return {
            escuela_id: escuelaId,
            alumno_id: a.id,
            mes: input.mes,
            monto,
            estado: "pendiente",
            fecha_pago: null,
            fecha_vencimiento: `${input.mes}-${dosDigitos(limite)}`,
          };
        });

      if (filas.length > 0) {
        const { error } = await supabase.from("pago").insert(filas);
        if (error) throw new Error(error.message);
      }
      return { creados: filas.length };
    }),

  // Comprobante de UN pago recibido (abono). El admin puede ver cualquiera de su
  // escuela; un padre solo los de sus hijos y mientras tenga el acceso activo.
  comprobante: protectedProcedure.input(z.string().min(1)).query(async ({ ctx, input }) => {
    const rol = ctx.usuario.rol;
    if (rol !== "admin" && rol !== "padre") {
      throw new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso a este comprobante." });
    }
    const admin = supabaseAdmin();
    const escuelaId = ctx.usuario.escuela_id;
    const noEncontrado = new TRPCError({ code: "NOT_FOUND", message: "Comprobante no encontrado." });

    const { data: ab } = await admin
      .from("pago_abono")
      .select(
        "id, monto, fecha_pago, metodo_pago, observaciones, comprobante_numero, pago_id, pago(mes, monto, monto_pagado, alumno(id, nombre, nivel_cinta, grupo(nombre)))"
      )
      .eq("escuela_id", escuelaId)
      .eq("id", input)
      .maybeSingle();
    if (!ab) throw noEncontrado;

    const pago = (Array.isArray(ab.pago) ? ab.pago[0] : ab.pago) as {
      mes: string;
      monto: number;
      monto_pagado: number;
      alumno: unknown;
    } | null;
    const alumnoRaw = pago ? (Array.isArray(pago.alumno) ? pago.alumno[0] : pago.alumno) : null;
    const alumno = alumnoRaw as {
      id: string;
      nombre: string;
      nivel_cinta: string | null;
      grupo: { nombre: string } | { nombre: string }[] | null;
    } | null;
    if (!pago || !alumno) throw noEncontrado;

    if (rol === "padre") {
      const { data: vinculo } = await admin
        .from("alumno_padre")
        .select("alumno_id")
        .eq("escuela_id", escuelaId)
        .eq("usuario_id", ctx.user.id)
        .eq("alumno_id", alumno.id)
        .maybeSingle();
      if (!vinculo) throw noEncontrado;
      if (!(await alumnoAlDia(admin, alumno.id))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acceso suspendido." });
      }
    }

    const grupo = Array.isArray(alumno.grupo) ? alumno.grupo[0] : alumno.grupo;
    const partes = [grupo?.nombre, sinCinta(alumno.nivel_cinta) ? null : `Cinta ${alumno.nivel_cinta}`].filter(Boolean);

    const saldo = Math.max(0, Number(pago.monto) - Number(pago.monto_pagado));
    const nota: string[] = [];
    if (ab.observaciones) nota.push(String(ab.observaciones));
    if (saldo > 0) {
      nota.push(`Abono a la mensualidad de ${nombreMes(pago.mes)}. Saldo pendiente: ${cop(saldo)}.`);
    }

    return {
      numero: ab.comprobante_numero ? `MB-${String(ab.comprobante_numero).padStart(6, "0")}` : "—",
      estudiante: alumno.nombre,
      grupoNivel: partes.join(" · ") || "—",
      mes: pago.mes,
      fechaPago: (ab.fecha_pago ?? "") as string,
      metodo: (ab.metodo_pago ?? "") as string,
      monto: Number(ab.monto),
      observaciones: nota.join("\n"),
    };
  }),
});
