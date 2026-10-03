// Recorridos guiados del panel de gestión.
// Cada paso apunta a un elemento con el atributo data-tour="<target>"; si el elemento
// no existe (por rol o por falta de datos) el paso se omite. Sin target = paso centrado.
// En los textos, **así** se muestra en negrita.

export interface TourCtx {
  firstName: string;
  isSuper: boolean;
  isCompanyAdmin: boolean;
  isLeader: boolean;
}

type Text = string | ((c: TourCtx) => string);

export interface TourStep {
  target?: string;
  title: Text;
  body: Text;
  items?: string[] | ((c: TourCtx) => string[]);
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

export interface TourDef {
  name: string;
  steps: TourStep[];
}

export const TOURS: Record<string, TourDef> = {
  // ------------------------------------------------------------------ general
  panel: {
    name: 'Panel de gestión',
    steps: [
      {
        title: (c) => `¡Hola, ${c.firstName}! Te damos la bienvenida`,
        body: 'Este es el **panel de gestión**: aquí recibes, asignas, respondes y haces seguimiento a las solicitudes entre áreas. Te mostramos para qué sirve cada botón. Puedes salir cuando quieras con **Esc** o «Omitir recorrido».',
      },
      {
        target: 'sidebar',
        placement: 'right',
        title: 'Menú principal',
        body: 'Desde aquí entras a cada módulo. Pasa el cursor sobre un ícono para ver su nombre. Solo ves los módulos que tu rol te permite usar. Veamos cada uno.',
      },
      { target: 'nav-dashboard', placement: 'right', title: 'Dashboard', body: 'Tu resumen del día: indicadores, notificaciones recientes, asignaciones, calendario de vencimientos y cumplimiento de plazos.' },
      {
        target: 'nav-bandeja',
        placement: 'right',
        title: 'Bandeja de solicitudes',
        body: 'El listado completo de solicitudes con buscador y filtros. Desde aquí abres cada una para asignarla, aceptarla, responderla o trasladarla.',
      },
      {
        target: 'nav-formularios',
        placement: 'right',
        title: 'Formularios',
        body: 'Como líder de área, aquí creas y editas los **tipos de solicitud** de tus áreas: sus campos, su plazo de respuesta y si están publicados en la intranet.',
      },
      {
        target: 'nav-reportes',
        placement: 'right',
        title: 'Reportes',
        body: 'Indicadores de cumplimiento de plazos, volumen por mes, carga por área, empresa y responsable, y la lista de solicitudes vencidas. Se pueden exportar a CSV.',
      },
      {
        target: 'nav-notificaciones',
        placement: 'right',
        title: 'Notificaciones',
        body: 'El historial de avisos sobre tus solicitudes. El número verde indica cuántas no has leído. Los mismos avisos también te llegan por correo.',
      },
      {
        target: 'nav-empresas',
        placement: 'right',
        title: (c) => (c.isSuper ? 'Empresas e intranets' : 'Mi intranet'),
        body: (c) =>
          c.isSuper
            ? 'Crea la intranet de una nueva empresa del grupo o edita las existentes: marca y color, misión y visión, anuncios, áreas y documentos.'
            : 'Edita el contenido de la intranet de tu empresa: marca y color, misión y visión, anuncios, áreas y documentos publicados.',
      },
      {
        target: 'nav-areas',
        placement: 'right',
        title: 'Áreas',
        body: 'Las áreas que reciben solicitudes, sus líderes y colaboradores. Las áreas compartidas (como Calidad o Jurídica) atienden a varias empresas del grupo.',
      },
      { target: 'nav-usuarios', placement: 'right', title: 'Usuarios', body: 'Crea cuentas, define el rol de cada persona y activa o desactiva su acceso.' },
      { target: 'nav-perfil', placement: 'right', title: 'Mi perfil', body: 'Tus datos personales, tu contraseña y las áreas a las que perteneces.' },
      { target: 'brand', title: 'Logo del grupo', body: 'Haz clic en él desde cualquier página para volver al Dashboard.' },
      { target: 'topnav-links', title: 'Accesos rápidos', body: 'Los módulos que más se usan siempre a un clic: Dashboard, Solicitudes y, si tienes permiso, Reportes. El subrayado indica dónde estás.' },
      {
        target: 'search',
        title: 'Buscador de solicitudes',
        body: 'Escribe el **código**, el **asunto** o el **nombre del solicitante** y presiona Enter. Te lleva a la bandeja con los resultados.',
      },
      { target: 'theme', title: 'Tema claro u oscuro', body: 'Cambia la apariencia del panel. Tu elección se recuerda en este navegador.' },
      {
        target: 'help',
        title: 'Ayuda',
        body: 'Cuando quieras repetir este recorrido o ver el de la sección en la que estás, haz clic aquí.',
      },
      {
        target: 'bell',
        title: 'Notificaciones rápidas',
        body: 'Muestra tus últimos avisos sin salir de la página. Haz clic en uno para abrir la solicitud, o en «Marcar todo leído» para limpiar el contador.',
      },
      {
        target: 'user-menu',
        title: 'Tu cuenta',
        body: 'Abre un menú para ir a la **intranet de tu empresa**, entrar a **Mi perfil** o **cerrar sesión**.',
      },
      {
        target: 'new-request',
        title: 'Nueva solicitud',
        body: 'Abre el catálogo de solicitudes de tu intranet: eliges el área, el tipo de solicitud y diligencias el formulario. El área te responde dentro del plazo definido.',
      },
    ],
  },

  // ------------------------------------------------------------------ dashboard
  dashboard: {
    name: 'Dashboard',
    steps: [
      { target: 'dash-hello', title: 'Tu resumen del día', body: 'El Dashboard reúne lo que necesita tu atención. Todo se actualiza automáticamente cada minuto.' },
      { target: 'dash-new', title: 'Radicar una solicitud', body: 'Atajo para crear una solicitud nueva a cualquier área que atienda a tu empresa.' },
      {
        target: 'dash-card-pending',
        title: 'Por asignar',
        body: 'Solicitudes que llegaron a las áreas que lideras y aún no tienen responsable. Haz clic para verlas en la bandeja y asignarlas.',
      },
      {
        target: 'dash-card-escalations',
        title: 'Escalamientos',
        body: 'Un colaborador pidió escalar una solicitud porque no puede atenderla. Decide si la **reasignas**, la **trasladas** a otra área o la **devuelves**.',
      },
      { target: 'dash-card-accept', title: 'Por aceptar', body: 'Solicitudes que te asignaron. Debes **aceptarlas** antes de poder responderlas.' },
      { target: 'dash-card-progress', title: 'En gestión', body: 'Solicitudes que ya aceptaste y estás trabajando. Respóndelas antes de su fecha límite.' },
      {
        target: 'dash-card-overdue',
        title: 'Vencidas',
        body: 'Solicitudes que superaron su plazo y siguen sin respuesta. La tarjeta se pone en rojo cuando hay alguna. Haz clic para verlas.',
      },
      {
        target: 'dash-notifs',
        title: 'Notificaciones recientes',
        body: 'Los tres últimos movimientos de tus solicitudes. El punto verde indica que no la has leído. «Ver todas» abre el historial completo.',
      },
      {
        target: 'dash-assign',
        title: (c) => (c.isLeader ? 'Por gestionar en tus áreas' : 'Mis asignaciones'),
        body: 'Las solicitudes más recientes que esperan una acción tuya, con su prioridad y estado. Haz clic en una para abrirla; «Bandeja» te lleva al listado completo y «Radicar nueva solicitud» crea una.',
      },
      {
        target: 'dash-calendar',
        placement: 'left',
        title: 'Calendario de vencimientos',
        body: 'Cada punto marca una fecha límite (en rojo si ya venció). Cambia de mes con las flechas y haz clic en un día para ver qué vence ese día.',
      },
      {
        target: 'dash-tasks',
        title: 'Tareas activas',
        body: 'Las solicitudes a tu cargo con el tiempo que les queda. La barra muestra el **porcentaje del plazo consumido**: se pone ámbar al pasar el 75 % y roja cuando vence.',
      },
      { target: 'dash-cta', title: 'Crear solicitud', body: 'Otro acceso directo para radicar. Cada paso de la solicitud te llega también por correo.' },
      {
        target: 'dash-compliance',
        title: 'Cumplimiento a 90 días',
        body: 'Porcentaje de solicitudes respondidas dentro del plazo en los últimos 90 días: verde desde el 80 %, ámbar desde el 60 % y rojo por debajo. «Ver» abre los reportes.',
      },
      {
        target: 'dash-next',
        title: 'Próximo vencimiento',
        body: 'La solicitud abierta que vence primero. «Ver» la abre para consultarla y «Gestionar» te lleva directo a sus acciones.',
      },
    ],
  },

  // ------------------------------------------------------------------ bandeja
  inbox: {
    name: 'Bandeja de solicitudes',
    steps: [
      {
        target: 'inbox-tabs',
        title: 'Vistas de la bandeja',
        body: 'Cambia qué solicitudes ves:',
        items: (c) => [
          ...(c.isLeader ? ['**Mis áreas**: todo lo que llega a las áreas que lideras.'] : []),
          '**Asignadas a mí**: las que debes aceptar y responder.',
          ...(c.isSuper ? ['**Todo el holding**: las solicitudes de todas las empresas.'] : c.isCompanyAdmin ? ['**Mi empresa**: todas las solicitudes de tu empresa.'] : []),
          '**Radicadas por mí**: las que tú creaste, para hacerles seguimiento.',
        ],
      },
      { target: 'inbox-search', title: 'Buscar', body: 'Escribe un código, asunto o solicitante y presiona Enter para filtrar la lista.' },
      { target: 'inbox-status', title: 'Filtrar por estado', body: 'Radicada, asignada, en gestión, escalamiento solicitado, respondida o anulada.' },
      { target: 'inbox-area', title: 'Filtrar por área', body: 'Como lideras varias áreas, aquí eliges ver solo una de ellas.' },
      { target: 'inbox-company', title: 'Filtrar por empresa', body: 'Las áreas compartidas atienden a varias empresas: filtra para ver solo las solicitudes de una.' },
      { target: 'inbox-overdue', title: 'Solo vencidas', body: 'Actívalo para ver únicamente las solicitudes que superaron su plazo. Vuelve a hacer clic para quitar el filtro.' },
      { target: 'inbox-count', title: 'Resultados', body: 'Cuántas solicitudes cumplen los filtros actuales.' },
      {
        target: 'inbox-list',
        placement: 'top',
        title: 'Listado de solicitudes',
        body: 'Haz clic en una fila para abrir la solicitud. Las filas en rojo están vencidas.',
        items: [
          '**Responsable**: quién la atiende («Sin asignar» si aún no tiene).',
          '**Plazo consumido**: porcentaje del tiempo de respuesta ya usado.',
          '**Vencimiento**: tiempo restante, o si se respondió a tiempo o fuera de plazo.',
        ],
      },
      { target: 'inbox-pager', title: 'Páginas', body: 'La bandeja muestra 15 solicitudes por página. Usa las flechas para avanzar o retroceder.' },
    ],
  },

  // ------------------------------------------------------------------ detalle de solicitud
  request: {
    name: 'Detalle de la solicitud',
    steps: [
      { target: 'req-back', title: 'Volver', body: 'Regresa a la bandeja de solicitudes.' },
      {
        target: 'req-head',
        title: 'Encabezado',
        body: 'Código, tipo y asunto de la solicitud, su estado y prioridad. Debajo: el área que la tiene, la empresa, quién la radicó, quién es responsable y la fecha límite en días hábiles.',
      },
      {
        target: 'req-escalation',
        title: 'Escalamiento pendiente',
        body: 'El colaborador explica por qué no puede atenderla. Tú decides:',
        items: [
          '**Reasignar**: pasarla a otra persona de la misma área.',
          '**Trasladar a otra área**: enviarla al área que corresponde (puedes sumar días de plazo).',
          '**Devolver al colaborador**: que la siga atendiendo, con tus indicaciones.',
        ],
      },
      {
        target: 'req-assign',
        title: 'Asignar la solicitud',
        body: 'La solicitud espera responsable.',
        items: ['**Asignar**: elige a un colaborador del área o tómala tú.', '**Trasladar**: si no le corresponde a tu área, envíala a la que sí.'],
      },
      {
        target: 'req-accept',
        title: 'Aceptar o escalar',
        body: 'Te asignaron esta solicitud.',
        items: ['**Aceptar solicitud**: confirmas que la atiendes y se habilita la respuesta.', '**Solicitar escalamiento**: si no puedes atenderla, explica el motivo y vuelve al líder.'],
      },
      {
        target: 'req-respond',
        title: 'Responder',
        body: 'Escribe la respuesta para el solicitante, adjunta archivos si hace falta y pulsa **Enviar respuesta**. Si no puedes atenderla, usa **No puedo atenderla** para escalarla.',
      },
      { target: 'req-response', title: 'Respuesta', body: 'La respuesta enviada al solicitante, sus adjuntos y si se entregó dentro o fuera del plazo.' },
      { target: 'req-info', title: 'Información de la solicitud', body: 'Lo que diligenció el solicitante en el formulario, con sus adjuntos.' },
      {
        target: 'req-comments',
        title: 'Comentarios',
        body: 'Escribe mensajes para las personas involucradas, con adjuntos opcionales. Quedan en la traza y se notifican. Si tú la radicaste, aquí también puedes **anularla**.',
      },
      {
        target: 'req-sla',
        title: 'Plazo de respuesta',
        body: 'Tiempo restante para responder. Cambia de color al acercarse el vencimiento y se pone rojo si se vence. El sistema envía alertas automáticas antes y después.',
      },
      {
        target: 'req-leader',
        title: 'Acciones del líder',
        body: 'Aunque ya tenga responsable, como líder puedes **reasignarla** a otra persona del área o **trasladarla** a otra área.',
      },
      {
        target: 'req-trace',
        title: 'Traza de la solicitud',
        body: 'Cada paso queda registrado: quién lo hizo, cuándo, el mensaje y los adjuntos. Las etiquetas de correo indican a cuántas personas se notificó y si el envío falló.',
      },
    ],
  },

  // ------------------------------------------------------------------ formularios
  forms: {
    name: 'Formularios',
    steps: [
      {
        target: 'forms-new',
        title: 'Nuevo formulario',
        body: 'Crea un nuevo tipo de solicitud. Si lideras varias áreas, primero te pregunta para cuál es.',
      },
      {
        target: 'forms-area',
        title: 'Formularios por área',
        body: 'Cada tarjeta agrupa los formularios de un área e indica si es un área compartida del holding o propia de una empresa.',
      },
      { target: 'forms-add', title: 'Agregar', body: 'Crea un formulario directamente en esta área.' },
      {
        target: 'forms-table',
        title: 'Tabla de formularios',
        body: 'Para cada tipo de solicitud ves:',
        items: [
          '**Plazo**: días hábiles que tiene el área para responder.',
          '**Campos**: cuántas preguntas tiene.',
          '**Solicitudes**: cuántas se han radicado con él.',
          '**Versión**: sube cada vez que lo editas; las solicitudes anteriores conservan la suya.',
        ],
      },
      {
        target: 'forms-publish',
        title: 'Publicado',
        body: 'Activado: aparece en la intranet de las empresas que atiende el área. Desactivado: queda oculto como borrador y nadie puede radicarlo.',
      },
      {
        target: 'forms-actions',
        title: 'Acciones',
        body: 'Las herramientas de cada formulario:',
        items: [
          '**Editar** (lápiz): abre el constructor del formulario.',
          '**Duplicar**: crea una copia para partir de ella.',
          '**Eliminar**: si ya tiene solicitudes, solo se desactiva para no perder el historial.',
        ],
      },
    ],
  },

  // ------------------------------------------------------------------ constructor de formularios
  'form-builder': {
    name: 'Constructor de formularios',
    steps: [
      { target: 'fb-back', title: 'Volver', body: 'Regresa a la lista de formularios. Guarda antes si hiciste cambios.' },
      { target: 'fb-preview', title: 'Vista previa', body: 'Muestra el formulario tal como lo verá el solicitante en la intranet. Vuelve a hacer clic para seguir editando.' },
      {
        target: 'fb-save',
        title: 'Guardar',
        body: 'Guarda el formulario. El botón dice «Guardar cambios» cuando hay algo pendiente y «Guardado» cuando todo está al día. Los cambios solo aplican a las solicitudes nuevas.',
      },
      {
        target: 'fb-settings',
        title: 'Datos generales',
        body: 'Nombre del tipo de solicitud, área a la que pertenece (no se puede cambiar después de crearlo), prioridad con la que llegan por defecto y una descripción que ve el solicitante.',
      },
      {
        target: 'fb-sla',
        title: 'Plazo de respuesta',
        body: 'Días hábiles (lunes a viernes) que tiene el área para responder. Desliza la barra o escribe el número. De aquí salen la fecha límite y las alertas de vencimiento.',
      },
      { target: 'fb-icon', title: 'Ícono', body: 'El ícono con el que aparece este tipo de solicitud en el catálogo de la intranet.' },
      { target: 'fb-active', title: 'Publicado u oculto', body: 'Actívalo para que se pueda radicar desde las intranets. Desactivado queda como borrador.' },
      {
        target: 'fb-palette',
        placement: 'right',
        title: 'Tipos de campo',
        body: 'Haz clic en un tipo para agregarlo al final, o arrástralo al lugar exacto del formulario. Hay texto, párrafo, número, correo, fecha, listas, opciones, casillas, adjuntos y títulos de sección.',
      },
      {
        target: 'fb-canvas',
        title: 'Campos del formulario',
        body: 'Arrastra los campos para reordenarlos. Al pasar el cursor por uno aparecen sus botones para **subir**, **bajar**, **duplicar** o **eliminar**. Haz clic en un campo para editarlo. El asunto y la prioridad se piden siempre, no hace falta agregarlos.',
      },
      {
        target: 'fb-props',
        placement: 'left',
        title: 'Propiedades del campo',
        body: 'Al seleccionar un campo, aquí cambias su pregunta, el texto de ejemplo, la ayuda, las opciones de las listas, si es **obligatorio** y si ocupa el ancho completo o la mitad.',
      },
    ],
  },

  // ------------------------------------------------------------------ reportes
  reports: {
    name: 'Reportes',
    steps: [
      { target: 'rep-export', title: 'Exportar CSV', body: 'Descarga el detalle de las solicitudes con los filtros actuales, para abrirlo en Excel.' },
      { target: 'rep-area', title: 'Filtrar por área', body: 'Mira los indicadores de todas tus áreas o solo de una. Las compartidas están marcadas.' },
      { target: 'rep-company', title: 'Filtrar por empresa', body: 'Útil en las áreas compartidas: muestra solo las solicitudes de una empresa del grupo.' },
      { target: 'rep-from', title: 'Desde', body: 'Fecha inicial del periodo que quieres analizar.' },
      { target: 'rep-to', title: 'Hasta', body: 'Fecha final del periodo.' },
      { target: 'rep-presets', title: 'Periodos rápidos', body: 'Un clic para ver los últimos 30 días, 3, 6 o 12 meses.' },
      {
        target: 'rep-kpis',
        title: 'Indicadores clave',
        body: 'El resumen del periodo:',
        items: [
          '**Radicadas**: total, abiertas y anuladas.',
          '**Cumplimiento del plazo**: respondidas a tiempo sobre respondidas.',
          '**Vencidas abiertas**: superaron el plazo y siguen sin respuesta.',
          '**Tiempo medio de respuesta**: desde que se radica hasta que se responde.',
          '**Tiempo medio de aceptación**: desde que se asigna hasta que se acepta.',
          '**Escalamientos**: cuántas veces un colaborador pidió escalar.',
        ],
      },
      { target: 'rep-monthly', title: 'Radicadas vs. respondidas', body: 'Compara mes a mes cuántas solicitudes entran y cuántas se responden. Pasa el cursor por un punto para ver los números.' },
      {
        target: 'rep-by-area',
        title: 'Cumplimiento por área',
        body: 'Por cada área: respondidas a tiempo (verde), fuera de plazo (naranja) y vencidas sin respuesta (rojo).',
      },
      { target: 'rep-by-company', title: 'Solicitudes por empresa', body: 'Volumen radicado por cada empresa. Haz clic en una barra para filtrar todo el reporte por esa empresa.' },
      { target: 'rep-status', title: 'Estado actual', body: 'En qué estado están hoy las solicitudes del periodo.' },
      { target: 'rep-forms', title: 'Tipos más frecuentes', body: 'Qué formularios se usan más. Ayuda a decidir dónde reforzar el equipo o simplificar el proceso.' },
      {
        target: 'rep-assignees',
        title: 'Desempeño por responsable',
        body: 'Carga y cumplimiento de cada persona: asignadas, abiertas, respondidas, vencidas, tiempo medio y porcentaje de respuestas a tiempo.',
      },
      { target: 'rep-overdue', title: 'Vencidas sin respuesta', body: 'Las solicitudes que requieren atención urgente, con los días de atraso. Haz clic en una fila para abrirla.' },
    ],
  },

  // ------------------------------------------------------------------ empresas
  companies: {
    name: 'Empresas e intranets',
    steps: [
      { target: 'co-new', title: 'Nueva empresa', body: 'Abre el asistente paso a paso para crear la intranet de una nueva empresa del grupo.' },
      {
        target: 'co-card',
        title: 'Tarjeta de la empresa',
        body: 'Muestra su logo, el identificador de su dirección (/intranet/…), cuántos usuarios, áreas y solicitudes tiene, y su color de marca.',
      },
      { target: 'co-view', title: 'Ver intranet', body: 'Abre la intranet de la empresa tal como la ven sus colaboradores.' },
      { target: 'co-edit', title: 'Editar', body: 'Cambia la marca, el contenido, las áreas y los documentos de esa intranet.' },
      { target: 'co-add', title: 'Crear otra intranet', body: 'Otro acceso al asistente de nueva empresa.' },
    ],
  },

  'company-wizard': {
    name: 'Asistente de intranet',
    steps: [
      {
        target: 'wiz-steps',
        placement: 'right',
        title: 'Pasos del asistente',
        body: 'Haz clic en cualquier paso para ir a él. Los completados se marcan con ✓.',
        items: [
          '**Identidad**: nombre, identificador de la dirección y datos legales.',
          '**Marca y color**: colores, logo y portada, con vista previa.',
          '**Estrategia**: misión, visión, objetivos, propósito y valores.',
          '**Contenido**: anuncios, norma del sistema de gestión y organigrama.',
          '**Áreas**: las compartidas del holding que la atienden y sus áreas propias.',
          '**Administrador** o **Documentos**: quién gestiona la intranet, o los documentos publicados.',
          '**Revisión**: resumen final antes de guardar.',
        ],
      },
      { target: 'wiz-body', title: 'Paso actual', body: 'Completa aquí los datos del paso. La barra superior muestra tu avance. Los campos con * son obligatorios.' },
      { target: 'wiz-prev', title: 'Anterior', body: 'Vuelve al paso anterior sin perder lo que escribiste.' },
      { target: 'wiz-next', title: 'Siguiente', body: 'Valida el paso y avanza. En el último paso este botón crea la intranet o guarda los cambios.' },
      { target: 'wiz-view', title: 'Ver intranet', body: 'Abre la intranet publicada para revisar cómo se ve.' },
      { target: 'wiz-save', title: 'Guardar', body: 'Guarda los cambios en cualquier momento, sin llegar al último paso.' },
    ],
  },

  // ------------------------------------------------------------------ áreas
  areas: {
    name: 'Áreas',
    steps: [
      { target: 'areas-filter', title: 'Filtrar por empresa', body: 'Muestra solo las áreas que atienden a una empresa.' },
      { target: 'areas-new', title: 'Nueva área', body: 'Crea un área que reciba solicitudes: nombre, descripción, ícono y empresas que atiende.' },
      {
        target: 'areas-card',
        title: 'Tarjeta del área',
        body: 'Indica si es **compartida** (atiende a varias empresas) y a cuáles atiende, cuántos formularios y solicitudes tiene, y quiénes la integran.',
      },
      { target: 'areas-edit', title: 'Editar área', body: 'Cambia su nombre, descripción, ícono y, si eres superadministrador, las empresas que atiende.' },
      {
        target: 'areas-member',
        title: 'Integrantes',
        body: 'El **líder** recibe las solicitudes, las asigna, traslada y edita los formularios. Los **colaboradores** atienden las que se les asignan.',
      },
      { target: 'areas-role', title: 'Hacer líder / Quitar líder', body: 'Cambia el rol de la persona dentro del área. Un área puede tener más de un líder.' },
      { target: 'areas-remove', title: 'Quitar del área', body: 'Saca a la persona del área. Sus solicitudes anteriores conservan el historial.' },
      { target: 'areas-add', title: 'Agregar persona', body: 'Busca a alguien de cualquier empresa del grupo y súmalo como colaborador (o como líder, si administras el área).' },
    ],
  },

  // ------------------------------------------------------------------ usuarios
  users: {
    name: 'Usuarios',
    steps: [
      { target: 'users-search', title: 'Buscar', body: 'Encuentra personas por nombre o correo.' },
      { target: 'users-company', title: 'Filtrar por empresa', body: 'Muestra solo los usuarios de una empresa del grupo.' },
      { target: 'users-new', title: 'Nuevo usuario', body: 'Crea una cuenta con nombre, correo, cargo, rol y contraseña inicial. Las áreas se asignan después desde el módulo Áreas.' },
      {
        target: 'users-table',
        title: 'Lista de usuarios',
        body: 'Para cada persona: su empresa, su rol global y las áreas a las que pertenece. La corona indica que es líder de esa área.',
      },
      { target: 'users-active', title: 'Activo', body: 'Desactívalo para bloquear el acceso de una persona sin borrar su historial. Puedes reactivarlo cuando quieras.' },
      { target: 'users-edit', title: 'Editar', body: 'Cambia sus datos, su rol o asígnale una nueva contraseña.' },
    ],
  },

  // ------------------------------------------------------------------ notificaciones
  notifications: {
    name: 'Notificaciones',
    steps: [
      { target: 'notif-readall', title: 'Marcar todo como leído', body: 'Limpia el contador de notificaciones sin abrir cada una.' },
      {
        target: 'notif-list',
        title: 'Historial de avisos',
        body: 'Cada movimiento de tus solicitudes: asignaciones, respuestas, escalamientos y alertas de vencimiento. El punto morado indica que no la has leído; haz clic para abrir la solicitud.',
      },
    ],
  },

  // ------------------------------------------------------------------ perfil
  profile: {
    name: 'Mi perfil',
    steps: [
      { target: 'profile-data', title: 'Datos personales', body: 'Tu nombre, cargo y teléfono, tal como los ven tus compañeros.' },
      { target: 'profile-password', title: 'Cambiar contraseña', body: 'Escribe tu contraseña actual y la nueva (mínimo 8 caracteres). Si lo dejas vacío, no cambia.' },
      { target: 'profile-save', title: 'Guardar', body: 'Aplica los cambios de tus datos y tu contraseña.' },
      { target: 'profile-areas', title: 'Mis áreas', body: 'Las áreas a las que perteneces y si eres líder o colaborador. Las asigna un administrador.' },
      { target: 'profile-tours', title: 'Recorridos guiados', body: 'Si quieres volver a ver los recorridos de todas las secciones, reinícialos desde aquí.' },
    ],
  },
};

const ROUTES: [RegExp, string][] = [
  [/^\/app$/, 'dashboard'],
  [/^\/app\/bandeja$/, 'inbox'],
  [/^\/app\/solicitudes\/[^/]+$/, 'request'],
  [/^\/app\/formularios$/, 'forms'],
  [/^\/app\/formularios\/[^/]+$/, 'form-builder'],
  [/^\/app\/reportes$/, 'reports'],
  [/^\/app\/empresas$/, 'companies'],
  [/^\/app\/empresas\/[^/]+$/, 'company-wizard'],
  [/^\/app\/areas$/, 'areas'],
  [/^\/app\/usuarios$/, 'users'],
  [/^\/app\/notificaciones$/, 'notifications'],
  [/^\/app\/perfil$/, 'profile'],
];

/** Recorrido de la sección según la ruta actual */
export function tourKeyFor(pathname: string): string | null {
  const p = pathname.replace(/\/+$/, '') || '/';
  return ROUTES.find(([re]) => re.test(p))?.[1] ?? null;
}
