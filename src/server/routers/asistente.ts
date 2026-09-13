import { z } from "zod";
import OpenAI from "openai";
import { supabase } from "@/lib/supabase";
import { getEscuelaId } from "@/lib/tenant";
import { adminProcedure, router } from "../trpc";
import type { AlumnoRow, EjercicioRow, EventoRow, GrupoConAlumnos, PagoConAlumno } from "@/types/supabase";

const mensajeHistorial = z.object({
  rol: z.enum(["usuario", "asistente"]),
  contenido: z.string(),
});

type Herramienta = {
  definicion: OpenAI.Chat.Completions.ChatCompletionFunctionTool;
  ejecutar: (args: Record<string, unknown>, escuelaId: string) => Promise<string>;
};

const mesActual = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}`;
};

const herramientas: Herramienta[] = [
  {
    definicion: {
      type: "function",
      function: {
        name: "resumen_escuela",
        description:
          "Resumen general de la escuela: alumnos activos, ingresos del mes, pagos pendientes y asistencia promedio.",
        parameters: { type: "object", properties: {} },
      },
    },
    ejecutar: async (_args, escuelaId) => {
      const hoy = new Date();
      const mes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;
      const inicio = `${mes}-01`;
      const fin = `${mes}-31`;

      const [
        { data: alumnos },
        { data: pagos },
        { data: sesiones },
      ] = await Promise.all([
        supabase.from("alumno").select("*").eq("escuela_id", escuelaId),
        supabase.from("pago").select("*").eq("escuela_id", escuelaId).eq("mes", mes),
        supabase
          .from("sesion")
          .select("*")
          .eq("escuela_id", escuelaId)
          .gte("fecha", inicio)
          .lte("fecha", fin),
      ]);

      const activos = ((alumnos ?? []) as AlumnoRow[]).filter((a) => a.estado === "activo");
      const pagosList = (pagos ?? []) as PagoConAlumno[];
      const ingresos = pagosList
        .filter((p) => p.estado === "pagado")
        .reduce((sum, p) => sum + (p.monto ?? 0), 0);
      const pendientes = pagosList.filter((p) => p.estado !== "pagado").length;

      let asistencia = 0;
      const sesionIds = (sesiones ?? []) as { id: string }[];
      if (sesionIds.length) {
        const { data: asis } = await supabase
          .from("asistencia")
          .select("presente")
          .eq("escuela_id", escuelaId)
          .in("sesion_id", sesionIds.map((s) => s.id));
        if (asis?.length) {
          asistencia = Math.round(
            ((asis as { presente: boolean }[]).filter((a) => a.presente).length / asis.length) * 100
          );
        }
      }

      return JSON.stringify({
        mes,
        alumnosActivos: activos.length,
        ingresosMes: ingresos,
        pagosPendientes: pendientes,
        asistenciaPromedio: `${asistencia}%`,
      });
    },
  },
  {
    definicion: {
      type: "function",
      function: {
        name: "alumnos_con_faltas",
        description:
          "Alumnos con 3 o más faltas en el mes. Devuelve nombre, grupo y cantidad de faltas. Útil para alertar a padres.",
        parameters: {
          type: "object",
          properties: {
            mes: { type: "string", description: "Mes en formato YYYY-MM. Si se omite, el mes actual." },
            min_faltas: { type: "number", description: "Mínimo de faltas a filtrar. Por defecto 3." },
          },
        },
      },
    },
    ejecutar: async (args, escuelaId) => {
      const mes = (args.mes as string) || mesActual();
      const min = (args.min_faltas as number) || 3;
      const inicio = `${mes}-01`;
      const fin = `${mes}-31`;

      const { data: sesiones, error: sErr } = await supabase
        .from("sesion")
        .select("id")
        .eq("escuela_id", escuelaId)
        .gte("fecha", inicio)
        .lte("fecha", fin);
      if (sErr) return `Error consultando sesiones: ${sErr.message}`;

      const sesionIds = ((sesiones ?? []) as { id: string }[]).map((s) => s.id);
      if (!sesionIds.length) return JSON.stringify({ mes, alumnos: [] });

      const { data: asistencias, error: aErr } = await supabase
        .from("asistencia")
        .select("alumno_id, presente")
        .eq("escuela_id", escuelaId)
        .in("sesion_id", sesionIds);
      if (aErr) return `Error consultando asistencia: ${aErr.message}`;

      const faltasPorAlumno = new Map<string, number>();
      for (const a of (asistencias ?? []) as { alumno_id: string; presente: boolean }[]) {
        if (!a.presente) faltasPorAlumno.set(a.alumno_id, (faltasPorAlumno.get(a.alumno_id) ?? 0) + 1);
      }

      const { data: alumnos } = await supabase
        .from("alumno")
        .select("id, nombre, nivel_cinta, grupo_id")
        .eq("escuela_id", escuelaId);
      const { data: grupos } = await supabase
        .from("grupo")
        .select("id, nombre")
        .eq("escuela_id", escuelaId);

      const alumnosRow = (alumnos ?? []) as AlumnoRow[];
      const gruposById = new Map(((grupos ?? []) as { id: string; nombre: string }[]).map((g) => [g.id, g.nombre]));

      const resultado: { alumno: string; grupo: string | null; faltas: number }[] = [];
      for (const alumno of alumnosRow) {
        const faltas = faltasPorAlumno.get(alumno.id) ?? 0;
        if (faltas >= min) {
          resultado.push({
            alumno: alumno.nombre,
            grupo: alumno.grupo_id ? gruposById.get(alumno.grupo_id) ?? null : null,
            faltas,
          });
        }
      }
      resultado.sort((a, b) => b.faltas - a.faltas);
      return JSON.stringify({ mes, alumnos: resultado });
    },
  },
  {
    definicion: {
      type: "function",
      function: {
        name: "pagos_pendientes",
        description:
          "Pagos pendientes o vencidos, con nombre del alumno, monto y mes. Útil para recordar a padres.",
        parameters: { type: "object", properties: {} },
      },
    },
    ejecutar: async (_args, escuelaId) => {
      const { data, error } = await supabase
        .from("pago")
        .select("mes, monto, estado, alumno(nombre)")
        .eq("escuela_id", escuelaId)
        .in("estado", ["pendiente", "vencido"]);
      if (error) return `Error consultando pagos: ${error.message}`;

      const resultado = (data as unknown as {
        mes: string;
        monto: number;
        estado: string;
        alumno: { nombre: string } | null;
      }[]).map((p) => ({
        alumno: p.alumno?.nombre ?? "Sin alumno",
        mes: p.mes,
        monto: p.monto,
        estado: p.estado,
      }));

      return JSON.stringify({ pagos: resultado });
    },
  },
  {
    definicion: {
      type: "function",
      function: {
        name: "grupos_y_alumnos",
        description:
          "Grupos con su horario (días, hora, entrenador) y número de alumnos activos en cada uno.",
        parameters: { type: "object", properties: {} },
      },
    },
    ejecutar: async (_args, escuelaId) => {
      const { data, error } = await supabase
        .from("grupo")
        .select("*, alumnos(*)")
        .eq("escuela_id", escuelaId);
      if (error) return `Error consultando grupos: ${error.message}`;

      const resultado = ((data ?? []) as GrupoConAlumnos[]).map((g) => ({
        nombre: g.nombre,
        categoria: g.categoria_edad,
        dias: g.dias,
        hora: `${g.hora_inicio}–${g.hora_fin}`,
        entrenador: g.entrenador,
        alumnosActivos: (g.alumnos ?? []).filter((a) => a.estado === "activo").length,
      }));

      return JSON.stringify({ grupos: resultado });
    },
  },
  {
    definicion: {
      type: "function",
      function: {
        name: "biblioteca_ejercicios",
        description:
          "Ejercicios de la biblioteca para armar planes de clase. Filtrable por categoría (calentamiento, tecnica, fisico, actitud) o dificultad (basica, intermedia, avanzada).",
        parameters: {
          type: "object",
          properties: {
            categoria: {
              type: "string",
              description:
                "Categoría opcional: calentamiento, tecnica, fisico, actitud. No incluyas si no deseas filtrar.",
            },
            dificultad: {
              type: "string",
              description:
                "Dificultad opcional: basica, intermedia, avanzada. No incluyas si no deseas filtrar.",
            },
          },
        },
      },
    },
    ejecutar: async (args, escuelaId) => {
      let query = supabase.from("ejercicio").select("*").eq("escuela_id", escuelaId);
      if (args.categoria) query = query.eq("categoria", args.categoria as string);
      if (args.dificultad) query = query.eq("dificultad", args.dificultad as string);

      const { data, error } = await query;
      if (error) return `Error consultando biblioteca: ${error.message}`;

      const resultado = ((data ?? []) as EjercicioRow[]).map((e) => ({
        nombre: e.nombre,
        categoria: e.categoria,
        dificultad: e.dificultad,
        descripcion: e.descripcion ?? "",
        duracion: e.duracion ?? "",
      }));

      return JSON.stringify({ ejercicios: resultado });
    },
  },
  {
    definicion: {
      type: "function",
      function: {
        name: "proximos_eventos",
        description: "Próximos eventos (exámenes, torneos, seminarios) con fecha y lugar.",
        parameters: { type: "object", properties: {} },
      },
    },
    ejecutar: async (_args, escuelaId) => {
      const { data, error } = await supabase
        .from("evento")
        .select("nombre, fecha, tipo, lugar, descripcion")
        .eq("escuela_id", escuelaId)
        .gte("fecha", mesActual() + "-01")
        .order("fecha")
        .limit(10);
      if (error) return `Error consultando eventos: ${error.message}`;
      return JSON.stringify({ eventos: (data ?? []) as EventoRow[] });
    },
  },
  {
    definicion: {
      type: "function",
      function: {
        name: "consultar_deudas_y_prestamos",
        description:
          "Consulta las deudas por eventos, préstamos especiales (ej. dotaciones, torneos), montos asignados y saldos pendientes por alumno.",
        parameters: { type: "object", properties: {} },
      },
    },
    ejecutar: async (_args, escuelaId) => {
      const { data: deudas } = await supabase
        .from("deuda")
        .select("nombre, descripcion, created_at")
        .eq("escuela_id", escuelaId);

      const { data: asignaciones } = await supabase
        .from("deuda_alumno")
        .select("monto_total, monto_pagado, estado, alumno(nombre)")
        .eq("escuela_id", escuelaId);

      const lista = (asignaciones ?? []).map((a: unknown) => {
        const item = a as {
          monto_total: number;
          monto_pagado: number;
          estado: string;
          alumno: { nombre: string } | null;
        };
        return {
          alumno: item.alumno?.nombre ?? "Desconocido",
          montoTotal: item.monto_total,
          montoPagado: item.monto_pagado,
          saldo: Math.max(0, item.monto_total - item.monto_pagado),
          estado: item.estado,
        };
      });

      return JSON.stringify({
        eventosDeudas: deudas ?? [],
        deudasAlumnos: lista,
      });
    },
  },
];

const systemPrompt = `Eres Mantis, el asistente de inteligencia artificial de Mantis Box Sabanalarga, una escuela de artes marciales (estilo Mantis Box / Kung Fu) ubicada en Sabanalarga.

Usas las herramientas disponibles para responder con datos REALES de la escuela (alumnos, grupos, asistencia, pagos, deudas por eventos/préstamos, biblioteca de ejercicios, eventos). Nunca inventes cifras ni nombres: si no encuentras datos, dilo con honestidad y sugiere crearlos.

Reglas:
- Responde SIEMPRE en español colombiano, claro y directo, como hablándole a un entrenador.
- Sé breve y práctico; usa listas cuando haya varios elementos.
- Cuando te pidan recordatorios o mensajes para padres, redacta el texto casi listo para WhatsApp (puedes usar asteriscos para negritas) y sugiere a quién enviarlo.
- Cuando te pidan un plan de clase, pide o usa los datos de la biblioteca, arma un plan estructurado por bloques (calentamiento, técnica, físico, actitud) con duraciones, y sugiere dificultad según la categoría del grupo.
- Si la pregunta es demasiado amplia o los datos están incompletos, haz una pregunta de seguimiento para precisar.`;

const mensajesARama = (
  historial: z.infer<typeof mensajeHistorial>[]
): OpenAI.Chat.Completions.ChatCompletionMessageParam[] =>
  historial.map((m) => ({
    role: m.rol === "asistente" ? ("assistant" as const) : ("user" as const),
    content: m.contenido,
  }));

function getAIClient(): { client: OpenAI; model: string } {
  // 1. Groq (velocidad ultrarrápida, ideal para function calling)
  const groqKey =
    process.env.GROQ_API_KEY ||
    (process.env.OPENAI_API_KEY?.startsWith("gsk_") ? process.env.OPENAI_API_KEY : undefined);
  if (groqKey) {
    return {
      client: new OpenAI({
        apiKey: groqKey,
        baseURL: "https://api.groq.com/openai/v1",
      }),
      model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
    };
  }

  // 2. OpenRouter (soporte multimodelo y alta compatibilidad)
  const openrouterKey =
    process.env.OPENROUTER_API_KEY ||
    (process.env.OPENAI_API_KEY?.startsWith("sk-or-") ? process.env.OPENAI_API_KEY : undefined);
  if (openrouterKey) {
    return {
      client: new OpenAI({
        apiKey: openrouterKey,
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "https://mantisbox.app",
          "X-Title": "Mantis Box Manager",
        },
      }),
      model: process.env.OPENROUTER_MODEL ?? "meta-llama/llama-3.3-70b-instruct",
    };
  }

  // 3. OpenAI estándar
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    };
  }

  throw new Error(
    "No se ha configurado ninguna clave de API de IA (GROQ_API_KEY, OPENROUTER_API_KEY u OPENAI_API_KEY). Configúrala en .env.local o en Vercel."
  );
}

export const asistenteRouter = router({
  chat: adminProcedure
    .input(
      z.object({
        mensaje: z.string().min(1).max(2000),
        historial: z.array(mensajeHistorial).max(20).default([]),
      })
    )
    .mutation(async ({ input }) => {
      const escuelaId = await getEscuelaId();
      const { client: openai, model } = getAIClient();
      const tools = herramientas.map((h) => h.definicion);

      const historial: OpenAI.Chat.Completions.ChatCompletionMessageParam[] =
        mensajesARama(input.historial);
      historial.push({ role: "user", content: input.mensaje });

      const maxIteraciones = 5;
      let pasos = 0;

      for (let i = 0; i < maxIteraciones; i++) {
        const respuesta = await openai.chat.completions.create({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...historial],
          tools,
          tool_choice: "auto",
        });

        const mensaje = respuesta.choices[0]?.message;
        if (!mensaje) return { respuesta: "No obtuve respuesta del modelo.", pasos };

        if (mensaje.tool_calls?.length) {
          pasos += mensaje.tool_calls.length;
          historial.push(mensaje as OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam);

          for (const toolCall of mensaje.tool_calls) {
            if (toolCall.type !== "function") continue;
            const funcion = (toolCall as OpenAI.Chat.Completions.ChatCompletionMessageFunctionToolCall)
              .function;
            const herramienta = herramientas.find((h) => h.definicion.function.name === funcion.name);
            if (!herramienta) continue;

            let args: Record<string, unknown> = {};
            if (funcion.arguments) {
              try {
                args = JSON.parse(funcion.arguments) as Record<string, unknown>;
              } catch {
                args = {};
              }
            }

            const resultado = await herramienta.ejecutar(args, escuelaId);
            historial.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: resultado,
            });
          }
          continue;
        }

        return {
          respuesta: mensaje.content ?? "",
          pasos,
        };
      }

      return {
        respuesta: "Llegué al límite de consultas. Intenta ser más específico.",
        pasos,
      };
    }),
});