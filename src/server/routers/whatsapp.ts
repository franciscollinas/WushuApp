import { z } from "zod";
import { protectedProcedure, adminProcedure, router } from "../trpc";
import { enviarPlantilla, enviarTexto, whatsappConfigurado } from "@/lib/whatsapp";

const componentePlantilla = z.object({
  type: z.enum(["body", "header", "button"]),
  parameters: z
    .array(z.object({ type: z.string().default("text"), text: z.string().optional() }).passthrough())
    .optional(),
});

export const whatsappRouter = router({
  estado: protectedProcedure.query(() => {
    const url = process.env.NEXT_PUBLIC_APP_URL ?? "";
    return {
      configurado: whatsappConfigurado(),
      token: process.env.WHATSAPP_TOKEN ? "definido" : "falta",
      phoneId: process.env.WHATSAPP_PHONE_ID ? "definido" : "falta",
      appSecret: process.env.WHATSAPP_APP_SECRET ? "definido" : "falta",
      verifyToken: process.env.WHATSAPP_VERIFY_TOKEN ? "definido" : "falta",
      webhookUrl: url ? `${url}/api/whatsapp` : "Aún sin URL de producción",
    };
  }),

  enviarMensaje: adminProcedure
    .input(
      z.object({
        telefono: z.string().min(7),
        mensaje: z.string().min(1).max(4000),
      })
    )
    .mutation(async ({ input }) => {
      const resultado = await enviarTexto(input.telefono, input.mensaje);
      if (!resultado.ok) throw new Error(resultado.error);
      return { id: resultado.id };
    }),

  enviarPlantilla: adminProcedure
    .input(
      z.object({
        telefono: z.string().min(7),
        nombre: z.string().min(1),
        idioma: z.string().default("es"),
        componentes: z.array(componentePlantilla).default([]),
      })
    )
    .mutation(async ({ input }) => {
      const resultado = await enviarPlantilla(
        input.telefono,
        input.nombre,
        input.idioma,
        input.componentes
      );
      if (!resultado.ok) throw new Error(resultado.error);
      return { id: resultado.id };
    }),
});