import { router } from "./trpc";
import { alumnoRouter } from "./routers/alumno";
import { grupoRouter } from "./routers/grupo";
import { asistenciaRouter } from "./routers/asistencia";
import { pagoRouter } from "./routers/pago";
import { dashboardRouter } from "./routers/dashboard";
import { evaluacionRouter } from "./routers/evaluacion";
import { bibliotecaRouter } from "./routers/biblioteca";
import { eventoRouter } from "./routers/evento";
import { reporteRouter } from "./routers/reporte";
import { asistenteRouter } from "./routers/asistente";
import { whatsappRouter } from "./routers/whatsapp";
import { usuarioRouter } from "./routers/usuario";
import { deudaRouter } from "./routers/deuda";
import { portalRouter } from "./routers/portal";
import { fotoRouter } from "./routers/foto";

export const appRouter = router({
  alumno: alumnoRouter,
  grupo: grupoRouter,
  asistencia: asistenciaRouter,
  pago: pagoRouter,
  dashboard: dashboardRouter,
  evaluacion: evaluacionRouter,
  biblioteca: bibliotecaRouter,
  evento: eventoRouter,
  reporte: reporteRouter,
  asistente: asistenteRouter,
  whatsapp: whatsappRouter,
  usuario: usuarioRouter,
  deuda: deudaRouter,
  portal: portalRouter,
  foto: fotoRouter,
});

export type AppRouter = typeof appRouter;