import { TRPCError } from "@trpc/server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hoyColombia } from "@/lib/padres";
import { estaAlDia, mesesDe, DIA_LIMITE_PAGO } from "@/lib/pagos";
import { mismaCinta } from "@/lib/cinta";
import { protectedProcedure, router } from "../trpc";

// Portal del padre. Usa service-role porque el RLS ya no deja leer nada de un
// hijo que no está al día (bloqueo del día 5); aquí la propiedad del hijo y el
// bloqueo se verifican explícitamente antes de devolver datos.
export const portalRouter = router({
  mi: protectedProcedure.query(async ({ ctx }) => {
    if (ctx.usuario.rol !== "padre") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Esta sección es solo para padres." });
    }
    const escuelaId = ctx.usuario.escuela_id;
    const admin = supabaseAdmin();

    const { data: vinculos, error: errVinc } = await admin
      .from("alumno_padre")
      .select("alumno_id")
      .eq("escuela_id", escuelaId)
      .eq("usuario_id", ctx.user.id);
    if (errVinc) throw new Error(errVinc.message);
    const ids = (vinculos ?? []).map((v) => v.alumno_id as string);
    if (ids.length === 0) return [];

    const [{ data: escuela }, { data: alumnos, error: errAl }, { data: pagos }] = await Promise.all([
      admin.from("escuela").select("mensualidad_monto").eq("id", escuelaId).maybeSingle(),
      admin
        .from("alumno")
        .select(
          "id, nombre, fecha_nacimiento, categoria, nivel_cinta, estado, fecha_ingreso, created_at, grupo(*)"
        )
        .eq("escuela_id", escuelaId)
        .in("id", ids),
      admin
        .from("pago")
        .select("*")
        .eq("escuela_id", escuelaId)
        .in("alumno_id", ids)
        .order("fecha_vencimiento", { ascending: false }),
    ]);
    if (errAl) throw new Error(errAl.message);

    const montoMensualidad = Number(escuela?.mensualidad_monto ?? 0);
    const hoy = hoyColombia();
    const { mesActual, mesReferencia } = mesesDe(hoy);

    const fichas = [];
    for (const al of alumnos ?? []) {
      const susPagos = (pagos ?? []).filter((p) => p.alumno_id === al.id);
      const pagados = susPagos.filter((p) => p.estado === "pagado").map((p) => p.mes as string);
      const ingreso = String(al.fecha_ingreso ?? al.created_at).slice(0, 10);
      const alDia = estaAlDia(hoy, ingreso, pagados);

      const base = {
        alumno: {
          id: al.id as string,
          nombre: al.nombre as string,
          fecha_nacimiento: al.fecha_nacimiento as string | null,
          categoria: al.categoria as string,
          nivel_cinta: al.nivel_cinta as string,
          estado: al.estado as string,
          grupo: (Array.isArray(al.grupo) ? al.grupo[0] : al.grupo) as {
            nombre: string;
            dias: string;
            hora_inicio: string;
            hora_fin: string;
          } | null,
        },
        mensualidad: { monto: montoMensualidad, mes: mesReferencia },
      };

      // Bloqueado: no se devuelve nada del hijo salvo lo mínimo para el aviso.
      if (!alDia) {
        fichas.push({
          ...base,
          bloqueado: true as const,
          pagos: [],
          deudas: [],
          asistencia: { totalSesiones: 0, totalPresente: 0, porcentajeAsistencia: 0, recientes: [] },
          evaluaciones: [],
          ejercicios: [],
          recordatorio: null,
        });
        continue;
      }

      const [{ data: deudas }, { data: asistencias }, { data: evaluaciones }, { data: ejercicios }] =
        await Promise.all([
          admin
            .from("deuda_alumno")
            .select("*, deuda(*)")
            .eq("escuela_id", escuelaId)
            .eq("alumno_id", al.id)
            .order("created_at", { ascending: false }),
          admin
            .from("asistencia")
            .select("presente, sesion(fecha, tema)")
            .eq("escuela_id", escuelaId)
            .eq("alumno_id", al.id),
          admin
            .from("evaluacion")
            .select("id, fecha, tipo, resultado, nueva_cinta, observaciones")
            .eq("escuela_id", escuelaId)
            .eq("alumno_id", al.id)
            .order("fecha", { ascending: false })
            .limit(10),
          admin
            .from("ejercicio")
            .select("id, nombre, categoria, dificultad, descripcion, duracion, nivel_cinta, media_url")
            .eq("escuela_id", escuelaId)
            .order("nombre")
            .limit(200),
        ]);

      const filas = (asistencias ?? []).map((a) => {
        const s = Array.isArray(a.sesion) ? a.sesion[0] : a.sesion;
        return {
          presente: a.presente as boolean,
          fecha: (s?.fecha ?? "") as string,
          tema: (s?.tema ?? "") as string,
        };
      });
      const totalPresente = filas.filter((f) => f.presente).length;
      const recientes = [...filas].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 10);

      // Ejercicios de su cinta (o generales, sin cinta asignada), con foto o descripción.
      const susEjercicios = (ejercicios ?? []).filter(
        (e) =>
          (!e.nivel_cinta || mismaCinta(e.nivel_cinta, al.nivel_cinta)) &&
          (e.media_url || e.descripcion)
      );

      // Recordatorio: mensualidad del mes en curso sin pagar (desde el día 1).
      const pagoMes = susPagos.find((p) => p.mes === mesActual);
      const debeMesActual = ingreso.slice(0, 7) <= mesActual && pagoMes?.estado !== "pagado";

      fichas.push({
        ...base,
        bloqueado: false as const,
        pagos: susPagos,
        deudas: deudas ?? [],
        asistencia: {
          totalSesiones: filas.length,
          totalPresente,
          porcentajeAsistencia: filas.length ? Math.round((totalPresente / filas.length) * 100) : 0,
          recientes,
        },
        evaluaciones: evaluaciones ?? [],
        ejercicios: susEjercicios,
        recordatorio: debeMesActual
          ? {
              mes: mesActual,
              monto: Number(pagoMes?.monto ?? montoMensualidad),
              vence: `${mesActual}-${String(DIA_LIMITE_PAGO).padStart(2, "0")}`,
            }
          : null,
      });
    }

    return fichas;
  }),
});
