# 🔖 Bitácora de Desarrollo — Mantis Box Manager

**Versión:** 0.1.0 · **Fecha de entrega:** 10/09/2026
**Última actualización:** 11/09/2026 (puesta en marcha y endurecimiento de seguridad)
**Audiencia:** Product Owner (PO) y Arquitecto
**Proyecto:** Plataforma web de gestión para Mantis Box Sabanalarga (artes marciales)
**Repositorio local:** `C:\Users\UserMaster\Documents\Proyectos\WushuApp\mantis-box-manager`

> **Estado actual:** app web funcional, compilando y verificada; **el único paso pendiente es la
> configuración real de Supabase** (proyecto, schema y primer admin). La guía paso a paso está
> incrustada en `.env.local` — ver sección 10.

---

## 1. Resumen ejecutivo

Mantis Box Manager es una aplicación web para administrar una escuela de artes marciales en
Sabanalarga (Colombia): alumnos, grupos, asistencia, pagos, evaluaciones de cinturón,
comunicación con padres, biblioteca de entrenamiento, eventos, un asistente de inteligencia
artificial sobre los propios datos y una integración con WhatsApp Business API.

El objetivo de negocio es **reemplazar el control manual actual** (Excel, WhatsApp y papel) por
una herramienta única, rápida y usable desde el celular dentro del gimnasio, y que a futuro
pueda **venderse a otras escuelas como licencia** (modelo multi-tenant, igual que TuCajero).

El desarrollo se ejecutó en **3 fases** definidas en el brief. Las 3 están terminadas a nivel de
código, con los módulos compilando y pasando verificación de tipos, lint y build de producción.

| Fase | Alcance | Estado |
|---|---|---|
| 1 | MVP: alumnos, grupos, asistencia, pagos, dashboard | ✅ Completa |
| 2 | Evaluaciones, reportes para padres, biblioteca, eventos | ✅ Completa |
| 3 | Mantis Assistant (IA), WhatsApp Business API, multi-tenant | ✅ Completa (código) |

---

## 2. Decisiones de arquitectura

### 2.1 Stack tecnológico

| Capa | Elección | Justificación |
|---|---|---|
| Frontend | **Next.js 16.3.4** (App Router, `src/`, Turbopack, React 19) | SSR/CSR según necesidad, renders estáticos para pantallas de consulta |
| Backend | **tRPC v11.13** embebido en Next.js | Un solo lenguaje (TypeScript) de punta a punta; patrones reutilizados del proyecto TuCajero |
| Base de datos | **PostgreSQL vía Supabase** (cliente `supabase-js` v2) | Managed; sin administrar servidor propio; RLS disponible |
| Validación | **zod v4** | Esquemas compartidos entre UI y procedimientos tRPC |
| Serialización | **superjson** | Soporta `Date`, `Map`, etc. entre cliente y servidor |
| Estilos | **Tailwind CSS v4** + tema L.I.W.A. | Diseño propio de marca, mobile-first |
| Dashboard de datos | **TanStack Query v5** (vía tRPC) | Caché, invalidation y estados de carga |
| IA | **OpenAI API** (SDK `openai` v7) | Mantis Assistant con tool-calling |
| Notificaciones | **react-hot-toast**, enlaces `wa.me` y **WhatsApp Business API** | Comunicación de costo cero (Fase 1) a API oficial (Fase 3) |

### 2.2 Arquitectura lógica

```
Browser (React/TanStack) ── tRPC (httpBatchLink + superjson) ── Next.js API route
                                                                      │
                                              ┌───────────────────────┴───────────────┐
                                        Routers tRPC (server)                    Route Handlers
                                        alumno, grupo, asistencia,                 /api/whatsapp
                                        pago, evaluacion, biblioteca,               (webhook Meta)
                                        evento, reporte, dashboard,
                                        asistente, whatsapp
                                              │
                                        Supabase JS client
                                              │
                                        PostgreSQL (Supabase)
                                        tabla "escuela" (tenant) + 8 tablas de datos
```

**Flujo de datos clave:**
1. La UI invoca procedimientos tRPC tipados de extremo a extremo (zod valida la entrada).
2. Cada router filtra **por `escuela_id`** (multi-tenant) y consulta Supabase.
3. La respuesta regresa con superjson y TanStack la cachea en el cliente.

### 2.3 Decisiones importantes y aprendizajes técnicos

1. **tRPC v11 cambiaba la ubicación del transformer.** En v11, `superjson` se configura en el
   `httpBatchLink` del cliente (y en `initTRPC` del servidor), no en `createTRPCReact`. Este fue
   el primer bloqueo resuelto (error típico del patrón v10).
2. **Supabase tipado con `Database` hecho a mano resolvía todo a `never`.** El tipo `GenericSchema`
   exigido por `@supabase/supabase-js` v2 no se cumplía con tipos declarados a mano. **Decisión:
   cliente Supabase sin genérico + "tipos de fila" propios (`src/types/supabase.ts`) con cast
   explícito en el límite de cada router.** Es un punto de fricción conocido y documentado: el
   tipado de BD no es automático, pero quedó contenido en una capa.
3. **npm rechaza rutas con mayúsculas.** Se creó el proyecto en el subdirectorio `mantis-box-manager`
   (raíz `WushuApp` tiene mayúsculas).
4. **Multi-tenant sin auth por ahora.** El aislamiento se implementó **a nivel de aplicación**
   (cada consulta filtra por `escuela_id`). La base de datos aún tiene RLS abierto
   (`allow_all_*`). Para defensa en profundidad se recomienda migrar a RLS + Supabase Auth
   (ver sección 8).
5. **WhatsApp Business API requiere setup externo de Meta.** Se entregó el esqueleto funcional
   (envío de texto y plantillas, webhook con verificación de firma HMAC-SHA256) que no puede
   probarse de punta a punta sin credenciales reales (token, phone ID, app secret).
6. **El SDK de OpenAI v7 tipa las herramientas de forma estricta** (`ChatCompletionFunctionTool`,
   `ChatCompletionMessageFunctionToolCall`); se ajustaron los tipos del loop de tool-calling y se
   filtra `tool_calls` por `type === "function"`.

---

## 3. Bitácora por fase

### 3.1 Fase 1 — MVP (CONCLUIDA)

**Alcance:** sustituir el control manual en 5 módulos.

- **Alumnos:** CRUD completo (nombre, nacimiento, categoría infantil/juvenil/adulto, cinta,
  ingreso, estado, grupo, datos de acudiente, notas). Tabla densa con filtros.
- **Grupos:** CRUD con horario (días y horas), entrenador; asignar/quitar alumnos; vista con
  lista de alumnos por grupo.
- **Asistencia:** "abrir clase" (elegir grupo + fecha → se crea la sesión y las marcas de
  asistencia por alumno activo del grupo), marcar presente/ausente con un toque, cálculo de % de
  asistencia y alerta de **3+ faltas** en el mes.
- **Pagos:** mensualidad por alumno y mes, estados pagado/pendiente/vencido, vista de pendientes
  del mes y botón recordatorio que abre `wa.me` con mensaje prellenado.
- **Dashboard:** KPIs (alumnos activos, ingresos del mes, pagos pendientes, asistencia promedio),
  alertas de inasistencia, pagos pendientes y tabla de próximos eventos.

**Criterio de aceptación cumplido en código:** reemplaza el control manual de esos 5 módulos.

### 3.2 Fase 2 — Evaluaciones, reportes, biblioteca y eventos (CONCLUIDA)

- **Evaluaciones de cinturones:** ficha con tres bloques de criterios (técnica, físico, actitud),
  cada criterio `{nombre, nota 1–5}`; resultado **apto / no apto**; si es apto y se indica nueva
  cinta, **se actualiza automáticamente `alumno.nivel_cinta`**. Tipos: cinta/técnica/físico/general.
- **Reportes para padres:** generación automática de asistencia + progreso + estado de pago del mes
  con selector mensual; botones **copiar**, **enviar por `wa.me`** y **enviar por WhatsApp API**.
  Consumido desde la ficha de cada alumno.
- **Biblioteca de entrenamiento:** ejercicios catalogados por categoría
  (calentamiento/técnica/físico/actitud) y dificultad (básica/intermedia/avanzada) con descripción
  y duración. Base para planes de clase.
- **Eventos:** CRUD de exámenes/torneos/seminarios; vista próximos/pasados; **el dashboard ya lee
  eventos reales desde la BD** (se eliminó la tabla hardcodeada de Fase 1).

### 3.3 Fase 3 — IA, WhatsApp y multi-tenant (CONCLUIDA)

- **Mantis Assistant (IA):** chat en `/asistente` que consulta los datos reales de la escuela con
  tool-calling de OpenAI. Herramientas disponibles:
  - `resumen_escuela` — KPIs generales del mes.
  - `alumnos_con_faltas` — alumnos con ≥3 faltas (u otro mínimo), con grupo y mes.
  - `pagos_pendientes` — pendientes/vencidos con alumno y monto.
  - `grupos_y_alumnos` — horarios y conteo de activos por grupo.
  - `biblioteca_ejercicios` — filtrable por categoría/dificultad (para planes de clase).
  - `proximos_eventos` — eventos próximos.
  - Asistente con historial, sugerencias de preguntas y UI de burbujas. Modelo configurable
    (`OPENAI_MODEL`, default `gpt-4o-mini`).
- **WhatsApp Business API:** servicio Graph API en `src/lib/whatsapp.ts` con envío de **texto libre**
  (ventana de 24 h) y **plantillas aprobadas** (mensajes proactivos con parámetros), verificación de
  webhook (handshake) y **validación de firma HMAC-SHA256** (`X-Hub-Signature-256`). Webhook en
  `/api/whatsapp`. Panel de diagnóstico y prueba en `/whatsapp`. Botón "Enviar por API" en la ficha
  del alumno.
- **Multi-tenant:** tabla `escuela` (tenants con `slug`, `plan`, `activa`) + columna `escuela_id`
  con FK en las 8 tablas de datos, índices por escuela, seed de "Mantis Box Sabanalarga" (slug
  `mantisbox`). Resolver `getEscuelaId()` en `src/lib/tenant.ts` valida que el `ESCUELA_SLUG`
  exista y esté activo (con caché por proceso). **Todas las consultas de todos los routers filtran
  por `escuela_id`**, incluidos agregados y las herramientas del asistente. Nuevas escuelas: insertar
  fila en `escuela` y desplegar la misma app con su `ESCUELA_SLUG`.

---

## 4. Estructura del código actual

### 4.1 Rutas de la aplicación (App Router)

| Ruta | Tipo | Módulo |
|---|---|---|
| `/` | Estática | Dashboard (KPIs, alertas, eventos) |
| `/alumnos` | Estática | Tabla de alumnos con filtros y CRUD |
| `/alumnos/[id]` | Dinámica | Ficha del alumno + reporte para padres + envío WhatsApp |
| `/grupos` | Estática | Grupos con horario y alumnos |
| `/asistencia` | Estática | Abrir clase / marcar asistencia / faltas |
| `/pagos` | Estática | Mensualidades y recordatorios |
| `/evaluaciones` | Estática | Evaluaciones de cinturón |
| `/biblioteca` | Estática | Biblioteca de entrenamiento |
| `/eventos` | Estática | Eventos próximos/pasados |
| `/asistente` | Estática | Mantis Assistant (chat IA) |
| `/whatsapp` | Estática | Panel de WhatsApp (estado + pruebas) |
| `/api/trpc/[trpc]` | Dinámica | Endpoint tRPC |
| `/api/whatsapp` | Dinámica | Webhook Meta (GET handshake / POST firmas) |

### 4.2 Routers tRPC (`src/server/routers/`)

`alumno.ts` · `grupo.ts` · `asistencia.ts` · `pago.ts` · `dashboard.ts` · `evaluacion.ts` ·
`biblioteca.ts` · `evento.ts` · `reporte.ts` · `asistente.ts` · `whatsapp.ts`

### 4.3 Capas y archivos clave

- `src/server/index.ts` — composición del `appRouter`.
- `src/server/trpc.ts` — inicialización de tRPC (router, publicProcedure, superjson).
- `src/lib/supabase.ts` — cliente Supabase (sin genérico, decisión documentada).
- `src/lib/tenant.ts` — resolver multi-tenant (`getEscuelaId`).
- `src/lib/whatsapp.ts` — servicio WhatsApp Business API.
- `src/types/supabase.ts` — tipos de fila y tipos con joins (fuente única de cast en routers).
- `src/types/db.ts` — **código muerto**: intento abandonado de tipo `Database` de Supabase; no se
  referencia en ningún módulo. **Pendiente de eliminar.**
- `src/components/ui/` — `Button`, `Badge`, `Field` (input/select/textarea), `KPI`, `Modal`.
- `src/components/` — `Sidebar`, `PageHeader`, `CriteriosEditor`, `providers/TRPCProvider`.
- `supabase/schema.sql` — schema completo (multi-tenant + RLS abierto + seed `mantisbox`).

---

## 5. Modelo de datos

```
escuela (id, nombre, slug [unique], plan [basico|pro], activa, created_at)
  └─ grupo      (id, escuela_id, nombre, categoria_edad, dias, hora_inicio, hora_fin, entrenador)
  └─ alumno     (id, escuela_id, nombre, fecha_nacimiento, categoria, nivel_cinta,
                 fecha_ingreso, estado, grupo_id→grupo, padre_nombre, padre_telefono, notas)
  └─ sesion     (id, escuela_id, grupo_id→grupo, fecha, tema, entrenador)
  └─ asistencia (id, escuela_id, sesion_id→sesion, alumno_id→alumno, presente, unique(sesion,alumno))
  └─ pago       (id, escuela_id, alumno_id→alumno, mes, monto, estado, fecha_pago,
                 fecha_vencimiento, unique(alumno,mes))
  └─ evaluacion (id, escuela_id, alumno_id→alumno, fecha, tipo, tecnica_json, fisico_json,
                 actitud_json, resultado [apto|no_apto], nueva_cinta, observaciones)
  └─ ejercicio  (id, escuela_id, nombre, categoria, dificultad, descripcion, duracion)
  └─ evento     (id, escuela_id, nombre, fecha, tipo [examen|torneo|seminario|otro], lugar, descripcion)
```

**Regla:`asistencia` se calcula:** `% = presentes / total de sesiones` del alumno en el rango,
alimentando dashboard y alertas de inasistencia.

---

## 6. Variables de entorno (`/.env.example`)

```
NEXT_PUBLIC_SUPABASE_URL    # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY  # anon key del proyecto
ESCUELA_SLUG                # slug de la escuela (tabla 'escuela'), ej. mantisbox
OPENAI_API_KEY              # API key de OpenAI (Mantis Assistant)
OPENAI_MODEL                # modelo por defecto (gpt-4o-mini)
WHATSAPP_TOKEN              # access token de WhatsApp Business API
WHATSAPP_PHONE_ID           # ID del número de negocio
WHATSAPP_APP_SECRET         # secreto de la app (firma de webhooks)
WHATSAPP_VERIFY_TOKEN       # token propio para handshake del webhook
WHATSAPP_API_VERSION        # versión de Graph API (v22.0)
```

`/.env.local` contiene placeholders; `.env.example` está versionable como plantilla.

---

## 7. Estado actual y verificación

- `npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npm run build` ✅ (build de producción generando
  13 rutas, incluidas 3 dinámicas: `/alumnos/[id]`, `/api/trpc/[trpc]`, `/api/whatsapp`).
- Dependencias instaladas y auditadas (0 vulnerabilidades conocidas en `openai` al instalarse).

---

## 8. Deudas técnicas y pasos pendientes

1. **Eliminar `src/types/db.ts`** (archivo muerto del intento de tipado Supabase). — ✅
   **Hecho el 10/09/2026** en la entrega de seguridad.
2. **Credenciales reales.** Único paso pendiente. `.env.local` ya trae la **guía paso a paso
   incrustada** (dónde sacar URL y anon key, correr el schema y crear el primer admin), y `/login`
   avisa con un mensaje cuando detecta que aún no hay valores reales. Sin esto no se prueba contra
   BD real.
3. **RLS multi-tenant a nivel de BD.** — ✅ **Implementado el 10/09/2026** junto con Supabase Auth
   y roles admin/entrenador (entrega de seguridad, sección 9).
4. **WhatsApp Business API sin credenciales de Meta.** Falta configuración externa de Meta:
   crear app, conectar número, aprobar plantillas. El webhook responde handshake y firma, pero no
   se probó con producción de Meta.
5. **Mantis Assistant sin API key real.** No se ejecutó una consulta real contra OpenAI; el loop
   de tool-calling está verificado por tipos y build, no por ejecución.
6. **Menú de gestión de escuelas no existe en UI.** El acceso por `ESCUELA_SLUG` es por despliegue;
   si se quiere gestión de tenants en la misma instancia, requiere UI + auth.
7. **Consideración de "mensajes proactivos".** El envío libre de texto solo funciona en la ventana
   de 24 h tras un mensaje del padre; para recordatorios proactivos masivos se deben usar plantillas
   aprobadas (`enviarPlantilla` ya implementado).
8. **Crear usuarios desde la UI requiere el id de auth.** Sin la service-role key no se puede crear
   la cuenta de Auth desde la app; el flujo documentado es Supabase Dashboard → Add user + SQL
   Editor (sección 9). Mejora a futuro: añadir `SUPABASE_SERVICE_ROLE_KEY` para crearlos en la app.

---

## 9. Entrega complementaria — Autenticación, roles y RLS (10/09/2026)

Resuelve los riesgos del Documento Maestro: **Supabase Auth con email/contraseña**, roles
**admin** y **entrenador**, **RLS por `escuela_id`** y limpieza de código muerto.

### Qué se implementó

- **Login** (`/login`) con Supabase Auth (email + contraseña) vía `@supabase/ssr` (cookies, sin
  localStorage). Botón **Salir** en el sidebar.
- **Proxy** (`src/proxy.ts`, nombre de middleware en Next.js 16): refresca la sesión, redirige a
  `/login` si no hay sesión o el usuario no está aprovisionado en la escuela, y re-dirige al
  entrenador fuera de las secciones de admin.
- **Procedimientos tRPC**: `protectedProcedure` (sesión + fila en `usuario`) y `adminProcedure`
  (rol `admin`). Todos los routers se migraron: entrenador puede usar asistencia y consultar
  alumnos/grupos (lectura); **pagos, dashboard, flujo de caja del asistente y gestión de usuarios
  quedan solo para admin**.
- **Cliente por request**: `src/lib/supabase.ts` usa `AsyncLocalStorage` + un Proxy que resuelve
  el cliente Supabase del request (lleva el JWT del usuario y el RLS aplica), **sin tocar la
  lógica de negocio de ningún router**.
- **Tabla `usuario`** (`id` → `auth.users`, `escuela_id`, `email`, `rol`) y página `/usuarios`
  (solo admin) para listar, cambiar rol y retirar usuarios.
- **RLS cerrado**: se eliminaron las políticas `allow_all_*`. Ahora cada tabla de datos solo es
  visible/editable para la escuela del usuario autenticado (vía helpers `usuario_escuela_id()` y
  `usuario_es_admin()`). El filtro por `escuela_id` a nivel de aplicación se mantiene como defensa
  adicional.

### Cómo arrancar con Auth (primer admin)

1. Ejecutar `supabase/schema.sql` en el SQL Editor de Supabase.
2. Crear la cuenta en **Authentication → Users → Add user** (correo + contraseña, o invitación).
3. Insertar su fila admin en `usuario`:

```sql
insert into public.usuario (id, escuela_id, email, rol)
values (
  '<uuid del usuario recién creado>',
  (select id from public.escuela where slug = 'mantisbox'),
  'tu@correo.com',
  'admin'
);
```

4. Iniciar sesión en `/login`. Para más admins/entrenadores: repetir pasos 2–3 (el id lo muestra
   Supabase Dashboard). También se puede crear desde la UI en `/usuarios` (SQL Editor), según el
   flujo documentado en la propia página.

### Permisos por rol

| Área | Entrenador | Admin |
|---|---|---|
| Asistencia (abrir clase, marcar, faltas) | ✅ | ✅ |
| Alumnos y grupos (consulta) | ✅ | ✅ |
| Alumnos y grupos (crear/editar/eliminar) | ❌ | ✅ |
| Pagos · Dashboard · Evaluaciones/edición · Biblioteca/edición · Eventos/edición | ❌ | ✅ |
| Mantis Assistant · WhatsApp (envíos) · Usuarios | ❌ | ✅ |

### Verificación

- `npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npm run build` ✅ (16 rutas; `/login` y `/usuarios`
  nuevas; · Proxy activo).
- Smoke test sobre build: `/` → 307 a `/login`; `/pagos`, `/grupos` → 307 si no hay sesión;
  `/login` → 200; `/api/trpc/*` → 401 «Inicia sesión para continuar.» sin JWT; `/api/whatsapp`
  sigue público (handshake 403 sin firma).

---

## 10. Sesión 11/09/2026 — Puesta en marcha y endurecimiento

### Qué se hizo

- **`.env.local` reescrito como guía de arranque**: contiene los 7 pasos para dejar la app
  funcionando (crear proyecto, copiar URL/anon key, ejecutar `supabase/schema.sql`, crear la cuenta
  en **Authentication → Add user**, insertar la fila admin, entrar). El PO solo pega sus valores y
  reinicia `npm run dev`.
- **Aviso en `/login`**: si no hay proyecto configurado, la pantalla muestra «Falta conectar
  Supabase» con las indicaciones. Ya no queda un formulario mudo.
- **Fix de seguridad RLS**: la política `usuario_select_own` se acotó a la escuela del admin.
  Antes, un admin de cualquier escuela podía leer los usuarios (correos) de *todas* las escuelas;
  ahora solo ve los de la suya. (`supabase/schema.sql`)
- **Fix de sesión en tRPC**: el handler de `/api/trpc` ahora recolecta las cookies de refresco que
  el SDK quiera escribir y las adjunta a la respuesta HTTP (antes quedaban perdidas). La renovación
  del JWT nunca más deja una llamada huérfana.
- **Limpieza**: se eliminó el helper sin uso `createSupabaseProxyClient` de `src/lib/auth.ts`, y el
  proxy (`src/proxy.ts`) reutiliza `obtenerUsuarioRow` en lugar de duplicarlo.

### Verificación (todos en verde)

- `npx tsc --noEmit` ✅ · `npm run lint` ✅ · `npm run build` ✅ (16 rutas + Proxy activo).
- Smoke tests en dev y en build: `/login` → 200 y muestra el aviso de configuración; `/` → 307 a
  `/login`; `/pagos`, `/grupos` → 307 sin sesión; `/api/trpc/*` → 401 sin JWT; `/api/whatsapp`
  sigue público (403 sin firma).
- Nota: se observó **un panic transitorio de Turbopack en Windows** (`0xc0000142` al compilar CSS
  en `npm run dev`) — es un fallo de spawn del proceso de la máquina, no del código; se resolvió
  reiniciando limpio (`rm -rf .next` + `npm run dev`) y el build no se ve afectado.

### Estado actual

| Aspecto | Estado |
|---|---|
| Código (tipos, lint, build, smoke tests) | ✅ Listo |
| Supabase real (proyecto + schema + admin) | ⏳ Pendiente (guía en `.env.local`) |
| OpenAI / WhatsApp (Fase 3) | ⏳ Opcional, sin credenciales |

---

## 11. Guía rápida para levantar el proyecto

```bash
cd "C:\Users\UserMaster\Documents\Proyectos\WushuApp\mantis-box-manager"
npm install
# 1) Abrir .env.local: tiene la guía paso a paso. Pegar URL y anon key de Supabase.
# 2) Ejecutar supabase/schema.sql en el SQL Editor de Supabase.
# 3) Crear la cuenta y su fila admin (pasos 5-6 de la guía del .env.local).
npm run dev          # desarrollo (http://localhost:3000)
npm run build        # build de producción
npm start            # servir el build
```

> El arranque del proyecto debe hacerse desde esta carpeta (`mantis-box-manager`): en la raíz de
> `WushuApp` no hay `package.json`, así que `npm run dev` allí no hace nada.

---

## 12. Anexo — Tema visual (estándar de marca)

- **Colores (sello L.I.W.A.):** rojo mantis `#A62639` (primario), dorado `#C99A2E` (acento),
  amarillo bandera `#F2C230` (secundario, uso moderado), tinta `#1F1B16` (texto),
  fondo cálido `#FBF8F3`. Verde = presente/pagado; rojo/ámbar = falta/pendiente.
- **Tipografía:** Lexend (una sola familia; pesos fuertes en KPIs).
- **Layout:** sidebar fijo en `#1F1B16` con el logotipo 武; KPIs grandes; tablas densas; asistencia
  optimizada para celular (lista vertical, un toque por alumno). Se evita el look genérico de
  dashboard SaaS.