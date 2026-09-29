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
frontend/src
  layouts/                AdminLayout (panel) e IntranetLayout (intranet con paleta por empresa)
  components/             RequestDetail (acciones + traza), DynamicForm, FileUpload, ui
  pages/admin, pages/intranet
```

## Pendientes recomendados antes de producción

- **Festivos:** el plazo cuenta lunes a viernes; falta un calendario de festivos de Colombia en `backend/src/common/business-days.ts`.
- **Adjuntos:** se sirven de forma estática en `/uploads` con nombres aleatorios; para información sensible conviene servirlos por un endpoint con verificación de acceso o moverlos a un almacenamiento privado (S3, Azure Blob).
- **Reportes:** se agregan en memoria; con volúmenes grandes conviene pasarlos a consultas SQL agregadas o vistas materializadas.
- Cambiar `JWT_SECRET`, configurar el SMTP real y restringir `FRONTEND_URL` (CORS).
