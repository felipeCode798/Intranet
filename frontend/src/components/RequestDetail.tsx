import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowLeftRight,
  Ban,
  Bell,
  CheckCircle2,
  CircleCheck,
  Clock,
  FilePlus2,
  Hourglass,
  Mail,
  MailCheck,
  MailX,
  MessageSquare,
  Repeat,
  Send,
  ShieldAlert,
  Undo2,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { api, errorMessage } from '../lib/api';
import { EVENT_LABEL, fmtDateTime, remaining } from '../lib/format';
import { Icon } from '../lib/icons';
import type { Area, DirectoryUser, FileValue, RequestDetail as RD } from '../lib/types';
import { DataView } from './DynamicForm';
import { AttachmentList, FileUpload } from './FileUpload';
import { Avatar, Loading, Modal, PriorityBadge, StatusBadge, useToast } from './ui';

const EV_ICON: Record<string, [ReactNode, string]> = {
  CREATED: [<FilePlus2 />, 'tone-violet'],
  ASSIGNED: [<UserPlus />, 'tone-blue'],
  REASSIGNED: [<Repeat />, 'tone-blue'],
  ACCEPTED: [<UserCheck />, 'tone-teal'],
  ESCALATION_REQUESTED: [<ShieldAlert />, 'tone-amber'],
  ESCALATION_REJECTED: [<Undo2 />, 'tone-amber'],
  TRANSFERRED: [<ArrowLeftRight />, 'tone-violet'],
  RESPONDED: [<CircleCheck />, 'tone-green'],
  COMMENTED: [<MessageSquare />, 'tone-gray'],
  DUE_SOON_ALERT: [<Hourglass />, 'tone-amber'],
  OVERDUE_ALERT: [<Bell />, 'tone-red'],
  CANCELLED: [<Ban />, 'tone-gray'],
};

function eventText(e: RD['events'][number]) {
  const m = e.meta || {};
  switch (e.type) {
    case 'ASSIGNED':
      return `Asignada a ${m.toUserName || '—'}`;
    case 'REASSIGNED':
      return `Reasignada${m.fromUserName ? ` de ${m.fromUserName}` : ''} a ${m.toUserName || '—'}`;
    case 'TRANSFERRED':
      return `De ${m.fromAreaName} a ${m.toAreaName}${m.extraDays ? ` · +${m.extraDays} día(s) hábil(es) de plazo` : ''}`;
    case 'ESCALATION_REQUESTED':
      return `Propone escalar a ${m.targetType === 'AREA' ? 'el área' : ''} ${m.targetName || ''}`;
    case 'ESCALATION_REJECTED':
      return `Continúa a cargo de ${m.toUserName || 'el responsable'}`;
    case 'RESPONDED':
      return m.late ? 'Respondida fuera del plazo' : 'Respondida dentro del plazo';
    default:
      return '';
  }
}

export function RequestDetail({ id }: { id: string }) {
  const { data: r, isLoading, error } = useQuery({ queryKey: ['request', id], queryFn: async () => (await api.get<RD>(`/requests/${id}`)).data });
  const qc = useQueryClient();
  const toast = useToast();
  const [modal, setModal] = useState<null | 'assign' | 'reassign' | 'transfer' | 'escalate' | 'reject' | 'cancel'>(null);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [commentFiles, setCommentFiles] = useState<FileValue[]>([]);
  const [response, setResponse] = useState('');
  const [responseFiles, setResponseFiles] = useState<FileValue[]>([]);

  const act = async (path: string, body: object = {}, ok = 'Listo') => {
    setBusy(true);
    try {
      await api.post(`/requests/${id}/${path}`, body);
      toast(ok);
      setModal(null);
      await qc.invalidateQueries({ queryKey: ['request', id] });
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['overview'] });
      return true;
    } catch (e) {
      toast(errorMessage(e), 'error');
      return false;
    } finally {
      setBusy(false);
    }
  };

  // Correos agrupados por evento (se emparejan por tipo y cercanía en el tiempo)
  const mailsByEvent = useMemo(() => {
    const map = new Map<string, RD['mailLogs']>();
    if (!r) return map;
    for (const ml of r.mailLogs) {
      const ev = [...r.events]
        .filter((e) => e.type === ml.event && new Date(e.createdAt).getTime() <= new Date(ml.createdAt).getTime() + 2000)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
      if (ev) map.set(ev.id, [...(map.get(ev.id) || []), ml]);
    }
    return map;
  }, [r]);

  if (isLoading) return <Loading />;
  if (error || !r) return <div className="card">{errorMessage(error)}</div>;

  const p = r.permissions;
  const pendingEsc = r.escalations.find((e) => e.status === 'PENDING');
  const requestFiles = r.attachments.filter((a) => a.kind === 'REQUEST');
  const responseAttach = r.attachments.filter((a) => a.kind === 'RESPONSE');
  const slaCls =
    r.status === 'RESOLVED' ? (r.resolvedLate ? 'done-late' : 'done') : r.status === 'CANCELLED' ? 'done' : r.isOverdue ? 'late' : r.slaProgress > 0.75 ? 'warn' : 'ok';

  return (
    <div className="req-layout">
      <div className="stack" style={{ gap: 20 }}>
        <div className="card" data-tour="req-head">
          <div className="req-head">
            <div className="ico-box lg">
              <Icon name={r.form.icon} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="row wrap small faint">
                <b className="bold" style={{ color: 'var(--p-600)' }}>{r.code}</b>·<span>{r.form.name}</span>
              </div>
              <h1>{r.subject}</h1>
              <div className="row wrap mt-sm">
                <StatusBadge status={r.status} lg />
                <PriorityBadge priority={r.priority} />
                {r.isOverdue && (
                  <span className="badge lg tone-red">
                    <AlertTriangle /> Atrasada
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="req-meta">
            <div>
              <small>Área actual</small>
              <b>
                <Icon name={r.area.icon} size={15} /> {r.area.name}
              </b>
            </div>
            <div>
              <small>Empresa</small>
              <b>
                <span className="dot" style={{ background: r.company.primaryColor }} /> {r.company.name}
              </b>
            </div>
            <div>
              <small>Solicitante</small>
              <b>
                <Avatar name={r.requester.name} size="sm" /> {r.requester.name}
              </b>
            </div>
            <div>
              <small>Responsable</small>
              <b>{r.assignee ? <><Avatar name={r.assignee.name} size="sm" /> {r.assignee.name}</> : <span className="faint">Sin asignar</span>}</b>
            </div>
            <div>
              <small>Radicada</small>
              <b>{fmtDateTime(r.createdAt)}</b>
            </div>
            <div>
              <small>Fecha límite · {r.slaDays} d hábiles</small>
              <b>{fmtDateTime(r.dueAt)}</b>
            </div>
          </div>
        </div>

        {/* Panel de acciones según permisos */}
        {p.canResolveEscalation && pendingEsc && (
          <div className="action-panel warn" data-tour="req-escalation">
            <h4>
              <ShieldAlert /> {pendingEsc.requestedBy.name} solicitó escalar esta solicitud
            </h4>
            <p>
              Propone escalar a{' '}
              <b>{pendingEsc.targetType === 'USER' ? pendingEsc.targetUser?.name : `el área ${pendingEsc.targetArea?.name}`}</b>.
            </p>
            <div className="msg" style={{ background: 'var(--card)', borderRadius: 12, padding: '10px 12px', fontSize: 13, whiteSpace: 'pre-wrap' }}>
              {pendingEsc.reason}
            </div>
            <div className="row wrap">
              <button className="btn" onClick={() => setModal('reassign')}>
                <Repeat /> Reasignar
              </button>
              <button className="btn dark" onClick={() => setModal('transfer')}>
                <ArrowLeftRight /> Trasladar a otra área
              </button>
              <button className="btn outline" onClick={() => setModal('reject')}>
                <Undo2 /> Devolver al colaborador
              </button>
            </div>
          </div>
        )}
        {p.canAssign && (
          <div className="action-panel" data-tour="req-assign">
            <h4>
              <UserPlus /> Esta solicitud espera asignación
            </h4>
            <p>Asígnala a un colaborador de {r.area.name} o tómala tú. Si no corresponde a tu área, trasládala.</p>
            <div className="row wrap">
              <button className="btn" onClick={() => setModal('assign')}>
                <UserPlus /> Asignar
              </button>
              <button className="btn outline" onClick={() => setModal('transfer')}>
                <ArrowLeftRight /> Trasladar
              </button>
            </div>
          </div>
        )}
        {p.canAccept && (
          <div className="action-panel" data-tour="req-accept">
            <h4>
              <UserCheck /> Se te asignó esta solicitud
            </h4>
            <p>Acéptala para empezar a gestionarla. Si no puedes atenderla, solicita escalarla explicando el motivo.</p>
            <div className="row wrap">
              <button className="btn success" disabled={busy} onClick={() => act('accept', {}, 'Solicitud aceptada')}>
                <CheckCircle2 /> Aceptar solicitud
              </button>
              <button className="btn warn" onClick={() => setModal('escalate')}>
                <ShieldAlert /> Solicitar escalamiento
              </button>
            </div>
          </div>
        )}
        {p.canRespond && (
          <div className="card" data-tour="req-respond">
            <div className="card-h">
              <h3>Responder solicitud</h3>
              <button className="btn sm warn" onClick={() => setModal('escalate')}>
                <ShieldAlert /> No puedo atenderla
              </button>
            </div>
            <div className="field">
              <label>Respuesta al solicitante</label>
              <textarea className="textarea" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Describe lo realizado y la información solicitada…" />
            </div>
            <div className="mt-sm">
              <FileUpload value={responseFiles} onChange={setResponseFiles} />
            </div>
            <div className="row mt" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn success"
                disabled={busy || response.trim().length < 5}
                onClick={async () => {
                  if (await act('respond', { responseText: response, attachments: responseFiles }, 'Respuesta enviada')) {
                    setResponse('');
                    setResponseFiles([]);
                  }
                }}
              >
                <Send /> Enviar respuesta
              </button>
            </div>
          </div>
        )}

        {r.status === 'RESOLVED' && (
          <div className="response-box" data-tour="req-response">
            <h3>
              <CircleCheck size={18} /> Respuesta {r.resolvedLate ? '(fuera de plazo)' : ''}
            </h3>
            <p>{r.responseText}</p>
            <AttachmentList files={responseAttach} />
            <div className="xs faint mt-sm">
              {r.assignee?.name} · {fmtDateTime(r.resolvedAt)}
            </div>
          </div>
        )}

        <div className="card" data-tour="req-info">
          <div className="card-h">
            <h3>Información de la solicitud</h3>
          </div>
          <DataView fields={r.formSnapshot} data={r.data} />
          {requestFiles.length > 0 && !r.formSnapshot.some((f) => f.type === 'file') && <AttachmentList files={requestFiles} />}
        </div>

        {p.canComment && (
          <div className="card" data-tour="req-comments">
            <div className="card-h">
              <h3>Comentarios</h3>
            </div>
            <textarea className="textarea" style={{ minHeight: 80 }} placeholder="Escribe un comentario para las personas involucradas…" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="mt-sm">
              <FileUpload value={commentFiles} onChange={setCommentFiles} />
            </div>
            <div className="row mt-sm" style={{ justifyContent: 'space-between' }}>
              {p.canCancel ? (
                <button className="btn sm danger" onClick={() => setModal('cancel')}>
                  <Ban /> Anular solicitud
                </button>
              ) : (
                <span />
              )}
              <button
                className="btn sm"
                disabled={busy || !comment.trim()}
                onClick={async () => {
                  if (await act('comments', { message: comment, attachments: commentFiles }, 'Comentario publicado')) {
                    setComment('');
                    setCommentFiles([]);
                  }
                }}
              >
                <MessageSquare /> Comentar
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Columna derecha: ANS + traza */}
      <div className="stack" style={{ gap: 20 }}>
        <div className={`sla-box ${slaCls}`} data-tour="req-sla">
          {slaCls === 'late' ? <AlertTriangle /> : slaCls === 'done' ? <CheckCircle2 /> : <Clock />}
          <div>
            <b>
              {r.status === 'RESOLVED'
                ? r.resolvedLate
                  ? 'Respondida fuera del plazo'
                  : 'Respondida dentro del plazo'
                : r.status === 'CANCELLED'
                  ? 'Solicitud anulada'
                  : remaining(r.remainingMs)}
            </b>
            <small>
              Plazo: {r.slaDays} día(s) hábil(es) · límite {fmtDateTime(r.dueAt)}
            </small>
          </div>
        </div>
        {(p.canReassign || p.canTransfer) && !p.canResolveEscalation && !p.canAssign && (
          <div className="card flat" data-tour="req-leader">
            <div className="small bold">Acciones del líder</div>
            <div className="row wrap mt-sm">
              {p.canReassign && (
                <button className="btn sm ghost" onClick={() => setModal('reassign')}>
                  <Repeat /> Reasignar
                </button>
              )}
              {p.canTransfer && (
                <button className="btn sm outline" onClick={() => setModal('transfer')}>
                  <ArrowLeftRight /> Trasladar
                </button>
              )}
            </div>
          </div>
        )}
        <div className="card" data-tour="req-trace">
          <div className="card-h">
            <h3>Traza de la solicitud</h3>
            <span className="xs faint">{r.mailLogs.length} correos</span>
          </div>
          <div className="timeline">
            {r.events.map((e) => {
              const [ico, tone] = EV_ICON[e.type] || [<Clock />, 'tone-gray'];
              const extra = eventText(e);
              const mails = mailsByEvent.get(e.id) || [];
              const atts = r.attachments.filter((a) => a.eventId === e.id);
              return (
                <div className="tl-item" key={e.id}>
                  <div className={`tl-ico ${tone}`}>{ico}</div>
                  <div className="tl-body">
                    <div className="row between">
                      <b>{EVENT_LABEL[e.type] || e.type}</b>
                      <span className="when">{fmtDateTime(e.createdAt)}</span>
                    </div>
                    <div className="who">{e.actor ? e.actor.name : 'Sistema'}{extra && ` · ${extra}`}</div>
                    {e.message && e.type !== 'RESPONDED' && <div className="msg">{e.message}</div>}
                    {atts.length > 0 && <AttachmentList files={atts} />}
                    {mails.length > 0 && (
                      <div className="mails">
                        {mails.map((m) => (
                          <span
                            key={m.id}
                            className={`badge ${m.status === 'SENT' ? 'tone-teal' : m.status === 'FAILED' ? 'tone-red' : 'tone-gray'}`}
                            title={`${m.subject}\nPara: ${m.to}\nEstado: ${m.status}`}
                          >
                            {m.status === 'SENT' ? <MailCheck /> : m.status === 'FAILED' ? <MailX /> : <Mail />}
                            {m.to.split(',').length} correo(s){m.status !== 'SENT' ? ` · ${m.status === 'FAILED' ? 'falló' : 'sin SMTP'}` : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {modal === 'assign' && <AssignModal r={r} busy={busy} onClose={() => setModal(null)} onSave={(b) => act('assign', b, 'Solicitud asignada')} title="Asignar solicitud" />}
      {modal === 'reassign' && (
        <AssignModal
          r={r}
          busy={busy}
          onClose={() => setModal(null)}
          onSave={(b) => act('reassign', b, 'Solicitud reasignada')}
          title="Reasignar a otra persona del área"
          suggested={pendingEsc?.targetUser?.id}
        />
      )}
      {modal === 'transfer' && <TransferModal r={r} busy={busy} onClose={() => setModal(null)} onSave={(b) => act('transfer', b, 'Solicitud trasladada')} suggested={pendingEsc?.targetArea?.id} />}
      {modal === 'escalate' && <EscalateModal r={r} busy={busy} onClose={() => setModal(null)} onSave={(b) => act('escalate', b, 'Escalamiento enviado al líder')} />}
      {modal === 'reject' && (
        <NoteModal
          title="Devolver al colaborador"
          subtitle="La solicitud seguirá a cargo de la misma persona. Indica cómo debe continuar."
          busy={busy}
          onClose={() => setModal(null)}
          onSave={(note) => act('reject-escalation', { note }, 'Escalamiento respondido')}
        />
      )}
      {modal === 'cancel' && (
        <NoteModal title="Anular solicitud" subtitle="Se notificará al área. Esta acción no se puede deshacer." busy={busy} danger onClose={() => setModal(null)} onSave={(note) => act('cancel', { note }, 'Solicitud anulada')} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- modales de acción
function useAreaMembers(areaId: string) {
  return useQuery({ queryKey: ['directory', areaId], queryFn: async () => (await api.get<DirectoryUser[]>('/users/directory', { params: { areaId } })).data });
}

function AssignModal({ r, title, busy, onClose, onSave, suggested }: { r: RD; title: string; busy: boolean; onClose: () => void; onSave: (b: object) => void; suggested?: string }) {
  const { data: people = [] } = useAreaMembers(r.area.id);
  const [assigneeId, setAssigneeId] = useState(suggested || '');
  const [note, setNote] = useState('');
  const list = people.filter((u) => u.id !== r.assignee?.id || r.status === 'ESCALATION_REQUESTED');
  return (
    <Modal
      title={title}
      subtitle={`Colaboradores de ${r.area.name}. Si te la asignas a ti queda aceptada automáticamente.`}
      icon={<UserPlus />}
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={!assigneeId || busy} onClick={() => onSave({ assigneeId, note: note || undefined })}>
            Confirmar
          </button>
        </>
      }
    >
      <div className="stack">
        {list.map((u) => {
          const role = u.memberships.find((m) => m.area.id === r.area.id)?.role;
          return (
            <label key={u.id} className={`select-card ${assigneeId === u.id ? 'on' : ''}`}>
              <input type="radio" hidden checked={assigneeId === u.id} onChange={() => setAssigneeId(u.id)} />
              <Avatar name={u.name} />
              <div>
                <b>{u.name}</b>
                <small>
                  {u.jobTitle || u.email} {role === 'LEADER' && '· Líder'}
                </small>
              </div>
              <span className="tick">{assigneeId === u.id && <CheckCircle2 />}</span>
            </label>
          );
        })}
        {!list.length && <div className="faint small">El área no tiene colaboradores. Agrégalos desde Áreas.</div>}
        <div className="field">
          <label>Nota para el responsable (opcional)</label>
          <textarea className="textarea" style={{ minHeight: 70 }} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
      </div>
    </Modal>
  );
}

function TransferModal({ r, busy, onClose, onSave, suggested }: { r: RD; busy: boolean; onClose: () => void; onSave: (b: object) => void; suggested?: string }) {
  const { data: areas = [] } = useQuery({ queryKey: ['areas', r.company.id], queryFn: async () => (await api.get<Area[]>('/areas', { params: { companyId: r.company.id } })).data });
  const [areaId, setAreaId] = useState(suggested || '');
  const [note, setNote] = useState('');
  const [extraDays, setExtraDays] = useState(0);
  const options = areas.filter((a) => a.id !== r.area.id);
  return (
    <Modal
      title="Trasladar a otra área"
      subtitle={`Solo se muestran áreas que atienden a ${r.company.name}. El líder de destino la recibirá para asignarla.`}
      icon={<ArrowLeftRight />}
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={!areaId || note.trim().length < 5 || busy} onClick={() => onSave({ areaId, note, extraDays: extraDays || undefined })}>
            Trasladar
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="field">
          <label>Área de destino</label>
          <select className="select" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">Selecciona el área</option>
            {options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} {a.isShared ? '· compartida' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Motivo del traslado</label>
          <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explica por qué la solicitud corresponde a esa área…" />
        </div>
        <div className="field">
          <label>Días hábiles adicionales al plazo (opcional)</label>
          <div className="sla-picker">
            <input type="range" min={0} max={10} value={extraDays} onChange={(e) => setExtraDays(Number(e.target.value))} />
            <span className="val">+{extraDays} día(s)</span>
          </div>
          <span className="help">Vencimiento actual: {fmtDateTime(r.dueAt)}</span>
        </div>
      </div>
    </Modal>
  );
}

function EscalateModal({ r, busy, onClose, onSave }: { r: RD; busy: boolean; onClose: () => void; onSave: (b: object) => void }) {
  const [targetType, setTargetType] = useState<'USER' | 'AREA'>('USER');
  const [targetUserId, setTargetUserId] = useState('');
  const [targetAreaId, setTargetAreaId] = useState('');
  const [reason, setReason] = useState('');
  const { data: people = [] } = useQuery({ queryKey: ['directory', 'all'], queryFn: async () => (await api.get<DirectoryUser[]>('/users/directory')).data });
  const { data: areas = [] } = useQuery({ queryKey: ['areas', r.company.id], queryFn: async () => (await api.get<Area[]>('/areas', { params: { companyId: r.company.id } })).data });
  const valid = reason.trim().length >= 10 && (targetType === 'USER' ? targetUserId : targetAreaId);
  return (
    <Modal
      title="Solicitar escalamiento"
      subtitle="La solicitud vuelve al líder del área, quien decidirá si la reasigna o la traslada."
      icon={<ShieldAlert />}
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={!valid || busy} onClick={() => onSave({ targetType, targetUserId: targetUserId || undefined, targetAreaId: targetAreaId || undefined, reason })}>
            Enviar al líder
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="tabs">
          <button className={targetType === 'USER' ? 'on' : ''} onClick={() => setTargetType('USER')}>
            A otra persona
          </button>
          <button className={targetType === 'AREA' ? 'on' : ''} onClick={() => setTargetType('AREA')}>
            A otra área
          </button>
        </div>
        {targetType === 'USER' ? (
          <div className="field">
            <label>Persona sugerida</label>
            <select className="select" value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
              <option value="">Selecciona una persona</option>
              {people
                .filter((u) => u.id !== r.assignee?.id)
                .map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} · {u.memberships.map((m) => m.area.name).join(', ') || u.company?.name}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <div className="field">
            <label>Área sugerida</label>
            <select className="select" value={targetAreaId} onChange={(e) => setTargetAreaId(e.target.value)}>
              <option value="">Selecciona un área</option>
              {areas
                .filter((a) => a.id !== r.area.id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>
        )}
        <div className="field">
          <label>¿Por qué no puedes atenderla?</label>
          <textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Explica el motivo (mínimo 10 caracteres)…" />
        </div>
      </div>
    </Modal>
  );
}

function NoteModal({ title, subtitle, busy, danger, onClose, onSave }: { title: string; subtitle: string; busy: boolean; danger?: boolean; onClose: () => void; onSave: (note: string) => void }) {
  const [note, setNote] = useState('');
  return (
    <Modal
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <>
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className={`btn ${danger ? 'danger' : ''}`} disabled={note.trim().length < 3 || busy} onClick={() => onSave(note)}>
            Confirmar
          </button>
        </>
      }
    >
      <textarea className="textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Escribe el mensaje…" autoFocus />
    </Modal>
  );
}
