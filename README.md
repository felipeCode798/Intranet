# Intranets y solicitudes · Grupo Playtech

Plataforma para crear y administrar una intranet por cada empresa del holding (Playtech, TuCompra, Enjambre, Enigma…) con un único sistema de solicitudes entre áreas, incluidas las áreas compartidas del holding (Calidad, Jurídica).

- **Stack:** React 19 + Vite · NestJS 11 · PostgreSQL 16 (Prisma 6)
- **Correo de pruebas:** Mailpit (todos los correos del sistema se ven en http://localhost:8025)

## Puesta en marcha

Requisitos: Node 20+ y Docker.

```bash
# 1. Base de datos + buzón de correo
docker compose up -d                 # PostgreSQL en :5433, Mailpit en :1025 / :8025

# 2. API
cd backend
npm install --include=dev
cp .env.example .env                 # en Windows: copy .env.example .env
npx prisma migrate deploy
npm run seed                         # datos de demostración (borra y recrea todo)
npm run start:dev                    # http://localhost:3100/api

# 3. Web
cd ../frontend
npm install --include=dev
npm run dev                          # http://localhost:5173
```

> Si tu entorno define `NODE_ENV=production` u `omit=dev` en npm, el `--include=dev` es necesario para instalar TypeScript, Vite y la CLI de Nest.
> Si la variable de entorno `PORT` está definida en tu sistema, tiene prioridad sobre el `.env`; el frontend espera el API en el 3100 (ver `frontend/vite.config.ts`).

### Usuarios de demostración (contraseña `Playtech2026*`)

| Rol | Correo |
|---|---|
| Superadministrador del holding | admin@grupoplaytech.com |
| Líder de Calidad (área compartida) | laura.gomez@grupoplaytech.com |
| Colaborador de Calidad | andres.rojas@grupoplaytech.com |
| Líder de Jurídica (área compartida) | carlos.mejia@grupoplaytech.com |
| Líder de Tecnología (Playtech) | juan.torres@playtech.com.co |
| Administrador de la intranet TuCompra | admin@tucompra.com.co |
| Empleada de TuCompra | rachel.lee@tucompra.com.co |

## Qué hace

### Intranet por empresa (`/intranet/:empresa`)
Misma estética para todas (basada en la intranet de TUCOMPRA), con la paleta calculada a partir del color de cada empresa: inicio con saludo, accesos, anuncios, documentos clave, carrusel de misión/visión, áreas que la atienden y calendario de vencimientos; catálogo de solicitudes por área, *Mis solicitudes*, despliegue estratégico, contexto organizacional (mapa de áreas y organigrama), documentación por proceso y sistema de gestión.

### Asistente de nueva empresa (`/app/empresas/nueva`, superadministrador)
Formulario por pasos: identidad → marca y color (paleta, logo, portada, con vista previa en vivo) → estrategia (misión, visión y sus imágenes, objetivos, propósito, valores) → contenido (anuncios, norma, organigrama) → áreas (compartidas del holding + propias con su líder) → administrador de la intranet → revisión. En edición el penúltimo paso gestiona los documentos publicados.

### Flujo de una solicitud

```
Radicada ──(líder asigna)──▶ Asignada ──(colaborador acepta)──▶ En gestión ──(responde + adjuntos)──▶ Respondida
    ▲                            │                                  │
    │                            └──────(pide escalar: persona/área + motivo)──┘
    │                                           ▼
    │                                 Escalamiento solicitado (vuelve al líder)
    │                                   ├─ Reasignar → a otra persona del área
    └──────── Trasladar ────────────────┤  (opcional: +N días hábiles)
                                        └─ Devolver al colaborador
```

- Cada **formulario** pertenece a un área, lo edita solo su líder (constructor visual: arrastrar campos, opciones, obligatorios, ancho, vista previa) y define su **plazo en días hábiles** y prioridad por defecto. Las solicitudes guardan una copia de los campos, así que editar un formulario no altera las ya radicadas.
- El colaborador **debe aceptar** antes de poder responder. Si el líder se asigna a sí mismo, queda aceptada automáticamente.
- **Trasladar** solo permite áreas que atienden a la empresa del solicitante.
- **Traza:** cada paso crea un evento (quién, cuándo, de/hacia qué persona o área, mensaje, adjuntos) y cada correo enviado queda registrado (`MailLog`) y se muestra junto al evento en el detalle.
- **Correos:** al líder cuando llega una solicitud o un escalamiento; al asignado cuando se le asigna o reasigna; al solicitante en cada avance; al área destino en los traslados; responsable y líderes en las alertas.
- **Alertas de ANS** (cada 10 minutos, `SlaService`): aviso *por vencer* (24 h antes, configurable) y *vencida*, con recordatorio cada 24 h mientras siga abierta. Visualmente: barra de plazo consumido, etiqueta roja "Vencida hace…", filas marcadas en la bandeja y lista de vencidas en reportes.

### Panel de gestión (`/app`)
Tablero con el estilo de la referencia (modo claro/oscuro): indicadores por rol, notificaciones, asignaciones, calendario de vencimientos, tareas con barra de ANS, cumplimiento a 90 días y próximo vencimiento. Además: bandeja (mis áreas / asignadas a mí / empresa u holding / radicadas por mí, con filtros), formularios, reportes, empresas, áreas, usuarios y notificaciones.

**Recorridos guiados:** la primera vez que una persona entra al panel y a cada módulo se abre un recorrido que resalta y explica cada botón y sección (solo los que su rol ve). Se repiten desde el botón **?** de la barra superior y se reinician en *Mi perfil*. Los textos están en `frontend/src/lib/tours.ts` y cada paso apunta a un elemento con `data-tour="…"`; lo ya visto se guarda en `User.toursSeen`.

### Configuración avanzada (`/app/configuracion`, superadministrador)
- **Módulos:** activa o desactiva *Intranet, Solicitudes y formularios, Reportes, Tareas, Asistencia, Horarios, Permisos y Desempeño* para todo el holding. Cada empresa puede heredar o anular cada módulo (Heredar / Activo / Inactivo).
- **Correos:** interruptor general para apagar el envío de correos de todo el sistema (solo el superadministrador). Apagado, no sale ningún correo —tampoco el código de asistencia, así que nadie podrá registrar entrada o salida—, las notificaciones internas siguen y cada intento queda en el registro de correos como `DISABLED`.
- **Al iniciar sesión:** elige si las personas llegan a la **intranet** o directo al **panel**; también se puede anular por empresa.
- Se aplica en el menú, en las rutas y en el API (un módulo apagado responde `403`). Dashboard, notificaciones, perfil, usuarios, áreas, empresas y esta pantalla siempre están disponibles.
- Todos los usuarios entran al panel (`/app`); antes solo lo hacían administradores y miembros de áreas.

### Tareas (`/app/tareas`)
El **líder de cada área** crea tareas y las asigna a los colaboradores de su área (título, descripción, prioridad, fecha límite). El asignado la inicia y la completa con una nota de cierre; el líder edita, reasigna, cancela o reabre. Tablero por estado, vista *Mis tareas* y *Tareas del equipo*. Notificación y correo al asignar y al completar.

### Asistencia (`/app/asistencia`)
Registro de entrada y salida **verificado por correo**:
1. La persona pulsa *Enviar código*; el sistema genera un código de 6 dígitos, lo guarda **cifrado (HMAC ligado al usuario)** y lo envía al correo de la cuenta.
2. Escribe el código; el API lo valida **solo contra los códigos emitidos al usuario de la sesión** (no se puede usar el código de otra persona), con vigencia de 10 minutos, 5 intentos, un solo uso y 60 s entre envíos.
3. Se registra la entrada o la salida y se compara con su horario (a tiempo, tarde con 10 min de tolerancia, salida anticipada).
Los líderes (sus áreas), administradores de intranet (su empresa) y superadministradores ven la pestaña **Equipo**: presentes, tardanzas, sin registro y personas con permiso aprobado.
> Requiere SMTP configurado (en desarrollo, Mailpit): si el correo no sale, el código no se emite.

### Horarios (`/app/horarios`)
Los **líderes asignan los horarios** de su área. Cada área define sus *turnos* (Mañana, Tarde, Noche, Descanso…, incluidos los nocturnos que cruzan la medianoche) y su **tipo de horario**:

| Tipo | Cómo se arma |
|---|---|
| Fijo | Un turno en los días de trabajo elegidos (p. ej. lunes a viernes) |
| Cambia cada día | Un turno por día de la semana, o editando la cuadrícula día por día |
| Cambia cada semana | Un turno distinto por semana dentro de un rango |
| Rotativo | Una secuencia que se repite (2 mañanas, 2 tardes, 2 noches, descanso…) con desfase entre personas |

La cuadrícula semanal permite cambiar cualquier celda, copiar la semana anterior y muestra los permisos de cada persona. Cada colaborador ve su horario en *Mi horario* y recibe una notificación cuando cambia. Una persona tiene un solo horario por día: si otra área ya se lo asignó, el cambio se omite y se informa.

### Permisos (`/app/permisos`)
Tipos: personal, médico, estudio, vacaciones, enfermedad y otros.
- **Médico (incapacidad):** obliga a adjuntar los documentos de la incapacidad.
- **Los demás:** piden *remunerado o no*, *si regresa a la empresa*, fecha de inicio y fin, *hora de salida y de regreso* (si regresa), descripción y razón adicional (opcional). Los soportes son opcionales.
- Al enviarlo llega **notificación y correo al líder** del área (si no hay, al administrador de la intranet y, al final, al superadministrador), que lo aprueba o rechaza (el rechazo exige motivo) desde *Por aprobar*. Nadie aprueba su propio permiso; el solicitante recibe la decisión y puede cancelar mientras esté vigente.

### Desempeño (`/app/desempeno`)
Mide a los colaboradores con la estructura de la hoja de cargos: **Área → Cargo → Rol**, y de cada rol cuelgan sus **KPI** (con qué se mide a quien lo desempeña) y sus **tareas** (en qué se invierte el tiempo, con el **tiempo dedicado a cada empresa** que atiende el área).
- **Cargos y KPI:** el líder (o el administrador) define los *cargos* del área (Junior, Semi, Senior, Administrador…), los *roles* de cada cargo (Backend, Frontend, Full Stack, Analista…), los *KPI* de cada rol (meta, unidad, si es mejor más alto o más bajo y cada cuánto se mide) y las *tareas* de cada rol. Asigna a las personas a cada rol. Lo que ya tiene historial no se borra: se archiva.
- **Mi desempeño:** el colaborador ve, por cada rol, sus KPI (meta, resultado y estado) y sus tareas, y registra con **Tiempo** cuánto dedicó a una tarea para una de las empresas del área (no se permiten fechas futuras ni más de 24 h por día). Ve su cumplimiento y una tabla Tarea × Empresa.
- **Equipo:** el líder elige el área (o **Todas las áreas**, con totales por empresa) y el periodo, **mide** cada KPI de un rol por colaborador (un valor por día, semana o mes según el KPI; si ya existe, se reemplaza) y puede registrar tiempo a nombre de alguien. El cumplimiento de un KPI es el promedio de sus mediciones del periodo frente a la meta (`valor/meta`, o `meta/valor` si menos es mejor): ≥ 100 % cumple, ≥ 80 % está cerca.
- El módulo se enciende o apaga en *Configuración avanzada* (clave `performance`).

### Reportes (`/app/reportes`)
KPIs (radicadas, cumplimiento del plazo, vencidas, tiempos medios de respuesta y aceptación, escalamientos), radicadas vs. respondidas por mes, cumplimiento por área, solicitudes por empresa, estado actual, tipos más frecuentes, desempeño por responsable, lista de vencidas y exportación CSV. En áreas compartidas el líder filtra por **empresa**.

## Roles y permisos

| Permiso | Superadmin | Admin. intranet | Líder de área | Colaborador de área | Empleado |
|---|:-:|:-:|:-:|:-:|:-:|
| Radicar solicitudes y ver las propias | ✓ | ✓ | ✓ | ✓ | ✓ |
| Aceptar, escalar y responder lo asignado | ✓ | ✓ | ✓ | ✓ | |
| Asignar, reasignar, trasladar | todas | | sus áreas | | |
| Editar formularios | todas | | sus áreas | | |
| Reportes | holding | su empresa | sus áreas (+ filtro por empresa) | | |
| Empresas / contenido de intranet | todas | la suya | | | |
| Áreas y miembros | todas | áreas propias | agregar colaboradores | | |
| Usuarios | todos | su empresa | | | |
| Configuración avanzada (módulos, inicio de sesión) | ✓ | | | | |
| Crear y asignar tareas | todas | | sus áreas | | |
| Definir cargos, roles, tareas y KPI; medir KPI | todas | áreas propias | sus áreas | | |
| Registrar el tiempo dedicado a cada empresa | ✓ | ✓ | ✓ | ✓ | ✓ |
| Asignar horarios | todas | | sus áreas | | |
| Aprobar permisos | todos | su empresa | sus áreas | | |
| Asistencia del equipo | todos | su empresa | sus áreas | | |
| Registrar asistencia, ver horario y pedir permisos | ✓ | ✓ | ✓ | ✓ | ✓ |

## Estructura

```
docker-compose.yml        PostgreSQL + Mailpit
backend/
  prisma/schema.prisma    modelo de datos (empresas, áreas compartidas, formularios, solicitudes, traza, escalamientos, correos)
  prisma/seed.ts          datos de demostración con histórico de 90 solicitudes
  src/auth                JWT, guards globales de sesión y rol
  src/companies           intranets y documentos
  src/areas, src/users    áreas (propias/compartidas), miembros, usuarios
  src/forms               formularios configurables y validación de campos
  src/requests            flujo de solicitudes, notificaciones y alertas de ANS
  src/reports             indicadores y CSV
  src/mail, src/files     correo (plantilla con el color de la empresa) y adjuntos
  src/settings            configuración avanzada por holding/empresa y guard de módulos (@RequireModule)
  src/notice              notificación interna + correo para tareas, horarios y permisos
  src/tasks, src/attendance, src/schedules, src/leaves   módulos de personal
  src/performance        cargos, roles, tareas, KPI, mediciones y tiempo por empresa
frontend/src
  layouts/                AdminLayout (panel) e IntranetLayout (intranet con paleta por empresa)
  components/             RequestDetail (acciones + traza), DynamicForm, FileUpload, ui
  pages/admin, pages/intranet   (admin: Tasks, Attendance, Schedules, Leaves, Settings)
  lib/schedule.ts         generadores de patrones de horario (fijo, diario, semanal, rotativo)
```

## Pendientes recomendados antes de producción

- **Festivos:** el plazo cuenta lunes a viernes; falta un calendario de festivos de Colombia en `backend/src/common/business-days.ts`.
- **Adjuntos:** se sirven de forma estática en `/uploads` con nombres aleatorios; para información sensible conviene servirlos por un endpoint con verificación de acceso o moverlos a un almacenamiento privado (S3, Azure Blob).
- **Reportes:** se agregan en memoria; con volúmenes grandes conviene pasarlos a consultas SQL agregadas o vistas materializadas.
- Cambiar `JWT_SECRET`, configurar el SMTP real y restringir `FRONTEND_URL` (CORS).
