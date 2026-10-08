import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hoyColombia } from "@/lib/padres";
import { estaAlDia } from "@/lib/pagos";
import { sinCinta } from "@/lib/cinta";
import { protectedProcedure, staffProcedure, adminProcedure, router } from "../trpc";
import type { PagoConAlumno, PagoRow } from "@/types/supabase";

const pagoInput = z.object({
  alumno_id: z.string(),
  mes: z.string(),
  monto: z.number().positive(),
  estado: z.enum(["pagado", "pendiente", "vencido"]),
  fecha_pago: z.string().nullable().optional(),
  fecha_vencimiento: z.string(),
  metodo_pago: z.string().trim().max(40).nullable().optional(),
  observaciones: z.string().trim().max(300).nullable().optional(),
});

export const pagoRouter = router({
  list: staffProcedure.query(async (): Promise<PagoConAlumno[]> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("pago")
      .select("*, alumno(*)")
      .eq("escuela_id", escuelaId)
      .order("fecha_vencimiento", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as PagoConAlumno[];
  }),

  listByMes: staffProcedure.input(z.string()).query(async ({ input }): Promise<PagoConAlumno[]> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("pago")
      .select("*, alumno(*)")
      .eq("escuela_id", escuelaId)
      .eq("mes", input)
      .order("fecha_vencimiento");
    if (error) throw new Error(error.message);
    return (data ?? []) as PagoConAlumno[];
  }),

  create: adminProcedure.input(pagoInput).mutation(async ({ input }): Promise<PagoRow> => {
    const escuelaId = await getEscuelaId();
    const { data, error } = await supabase
      .from("pago")
      .insert({ ...input, escuela_id: escuelaId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data as PagoRow;
  }),

  marcarPagado: adminProcedure
    .input(
      z.object({
        id: z.string(),
        fecha_pago: z.string(),
        metodo_pago: z.string().trim().max(40).optional(),
        observaciones: z.string().trim().max(300).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { error } = await supabase
        .from("pago")
        .update({
          estado: "pagado",
          fecha_pago: input.fecha_pago,
          ...(input.metodo_pago ? { metodo_pago: input.metodo_pago } : {}),
          ...(input.observaciones ? { observaciones: input.observaciones } : {}),
        })
        .eq("escuela_id", escuelaId)
        .eq("id", input.id);
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

  // Crea la mensualidad pendiente del mes para cada alumno activo que aún no
  // la tenga. El bloqueo del día 5 no depende de esto (se calcula con los pagos
  // 'pagado'): sirve para ver quién debe y mandar recordatorios.
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
        .select("id, fecha_ingreso, created_at")
        .eq("escuela_id", escuelaId)
        .eq("estado", "activo");
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
        .map((a) => ({
          escuela_id: escuelaId,
          alumno_id: a.id,
          mes: input.mes,
          monto,
          estado: "pendiente",
          fecha_pago: null,
          fecha_vencimiento: `${input.mes}-05`,
        }));

      if (filas.length > 0) {
        const { error } = await supabase.from("pago").insert(filas);
        if (error) throw new Error(error.message);
      }
      return { creados: filas.length };
    }),

  // Datos del comprobante de un pago ya confirmado. El admin puede ver cualquiera
  // de su escuela; un padre solo los de sus hijos y mientras esté al día.
  comprobante: protectedProcedure.input(z.string().min(1)).query(async ({ ctx, input }) => {
    const rol = ctx.usuario.rol;
    if (rol !== "admin" && rol !== "padre") {
      throw new TRPCError({ code: "FORBIDDEN", message: "No tienes acceso a este comprobante." });
    }
    const admin = supabaseAdmin();
    const escuelaId = ctx.usuario.escuela_id;

    const { data: p } = await admin
      .from("pago")
      .select("*, alumno(id, nombre, nivel_cinta, fecha_ingreso, created_at, grupo(nombre))")
      .eq("escuela_id", escuelaId)
      .eq("id", input)
      .maybeSingle();
    if (!p || p.estado !== "pagado") {
      throw new TRPCError({ code: "NOT_FOUND", message: "Comprobante no encontrado." });
    }
    const alumno = (Array.isArray(p.alumno) ? p.alumno[0] : p.alumno) as {
      id: string;
      nombre: string;
      nivel_cinta: string | null;
      fecha_ingreso: string | null;
      created_at: string;
      grupo: { nombre: string } | { nombre: string }[] | null;
    } | null;
    if (!alumno) throw new TRPCError({ code: "NOT_FOUND", message: "Comprobante no encontrado." });

    if (rol === "padre") {
      const { data: vinculo } = await admin
        .from("alumno_padre")
        .select("alumno_id")
        .eq("escuela_id", escuelaId)
        .eq("usuario_id", ctx.user.id)
        .eq("alumno_id", alumno.id)
        .maybeSingle();
      if (!vinculo) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Comprobante no encontrado." });
      }
      const { data: pagados } = await admin
        .from("pago")
        .select("mes")
        .eq("escuela_id", escuelaId)
        .eq("alumno_id", alumno.id)
        .eq("estado", "pagado");
      const ingreso = String(alumno.fecha_ingreso ?? alumno.created_at).slice(0, 10);
      if (!estaAlDia(hoyColombia(), ingreso, (pagados ?? []).map((x) => x.mes as string))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Acceso suspendido por pago pendiente." });
      }
    }

    const grupo = Array.isArray(alumno.grupo) ? alumno.grupo[0] : alumno.grupo;
    const partes = [grupo?.nombre, sinCinta(alumno.nivel_cinta) ? null : `Cinta ${alumno.nivel_cinta}`].filter(Boolean);
    return {
      numero: p.comprobante_numero ? `MB-${String(p.comprobante_numero).padStart(6, "0")}` : "—",
      estudiante: alumno.nombre,
      grupoNivel: partes.join(" · ") || "—",
      mes: p.mes as string,
      fechaPago: (p.fecha_pago ?? "") as string,
      metodo: (p.metodo_pago ?? "") as string,
      monto: Number(p.monto),
      observaciones: (p.observaciones ?? "") as string,
    };
  }),
});