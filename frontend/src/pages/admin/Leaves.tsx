import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarOff, Check, Eye, FileHeart, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { AttachmentList, FileUpload } from '../../components/FileUpload';
import { Avatar, Empty, Loading, Modal, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import { fmtDayFull, todayYmd } from '../../lib/schedule';
import { LEAVE_LABEL, LEAVE_STATUS, LEAVE_TYPES } from '../../lib/leaves';
import type { FileValue, Leave, LeaveType } from '../../lib/types';

type Tab = 'mine' | 'review' | 'team';

export default function Leaves() {
  const { isLeader, isCompanyAdmin } = useAuth();
  const reviewer = isLeader || isCompanyAdmin;
  const qc = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const [tab, setTab] = useState<Tab>('mine');
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const detailId = sp.get('id');

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['leaves', tab, status],
    queryFn: async () => (await api.get<Leave[]>('/leaves', { params: { scope: tab, status: status || undefined } })).data,
  });
  const { data: pending } = useQuery({
    queryKey: ['leaves', 'pending-count'],
    queryFn: async () => (await api.get<{ pending: number }>('/leaves/pending-count')).data.pending,
    enabled: reviewer,
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ['leaves'] });
  const close = () => {
    sp.delete('id');
    setSp(sp, { replace: true });
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Permisos</h1>
          <p className="page-sub">Solicita permisos, vacaciones o envía tu incapacidad. Tu líder recibe la notificación y decide.</p>
        </div>
        <div className="row wrap">
          {reviewer && (
            <div className="tabs">
              <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
                Mis permisos
              </button>
              <button className={tab === 'review' ? 'on' : ''} onClick={() => setTab('review')}>
                Por aprobar {!!pending && <span className="count">{pending}</span>}
              </button>
              <button className={tab === 'team' ? 'on' : ''} onClick={() => setTab('team')}>
                Historial del equipo
              </button>
            </div>
          )}
          {tab !== 'review' && (
            <select className="select sm" style={{ width: 'auto' }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por estado">
              <option value="">Todos los estados</option>
              {Object.entries(LEAVE_STATUS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          )}
          <button className="btn dark" onClick={() => setCreating(true)}>
            <Plus /> Nuevo permiso
          </button>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <Loading />
        ) : rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  {tab !== 'mine' && <th>Persona</th>}
                  <th>Tipo</th>
                  <th>Fechas</th>
                  <th>Estado</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id} className="clickable" onClick={() => setSp({ id: l.id }, { replace: true })}>
                    <td className="bold">{l.code}</td>
                    {tab !== 'mine' && (
                      <td>
                        <div className="row">
                          <Avatar name={l.user.name} url={l.user.avatarUrl} size="sm" />
                          <div>
                            <div className="bold">{l.user.name}</div>
                            <div className="xs faint">{l.area?.name ?? 'Sin área'}</div>
                          </div>
                        </div>
                      </td>
                    )}
                    <td>{LEAVE_LABEL[l.type]}</td>
                    <td>{l.startDate === l.endDate ? fmtDayFull(l.startDate) : `${fmtDayFull(l.startDate)} → ${fmtDayFull(l.endDate)}`}</td>
                    <td>
                      <span className={`badge tone-${LEAVE_STATUS[l.status].tone}`}>{LEAVE_STATUS[l.status].label}</span>
                    </td>
                    <td>
                      <button className="icon-btn sm" aria-label="Ver detalle">
                        <Eye />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title={tab === 'review' ? 'No tienes permisos por aprobar' : 'Aún no hay permisos'}
            text={tab === 'mine' ? 'Usa “Nuevo permiso” para hacer tu primera solicitud.' : undefined}
            icon={<CalendarOff />}
          />
        )}
      </div>

      {creating && <LeaveForm onClose={() => setCreating(false)} onSaved={refresh} />}
      {detailId && <LeaveDetail id={detailId} onClose={close} onChanged={refresh} />}
    </>
  );
}

// ------------------------------------------------------------------ detalle y decisión
function LeaveDetail({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const { data: l, isLoading, error } = useQuery({ queryKey: ['leave', id], queryFn: async () => (await api.get<Leave>(`/leaves/${id}`)).data });

  const act = async (action: 'approve' | 'reject' | 'cancel') => {
    setBusy(true);
    try {
      await api.post(`/leaves/${id}/${action}`, action === 'cancel' ? undefined : { note: note || undefined });
      toast(action === 'approve' ? 'Permiso aprobado' : action === 'reject' ? 'Permiso rechazado' : 'Permiso cancelado');
      qc.invalidateQueries({ queryKey: ['leave', id] });
      onChanged();
      if (action !== 'cancel') onClose();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title={l ? `${l.code} · ${LEAVE_LABEL[l.type]}` : 'Permiso'} subtitle={l ? `Solicitado por ${l.user.name}` : undefined} icon={<CalendarOff />} wide onClose={onClose}>
      {isLoading ? (
        <Loading />
      ) : error || !l ? (
        <p className="small">{errorMessage(error)}</p>
      ) : (
        <div className="stack">
          <div className="row wrap" style={{ gap: 8 }}>
            <span className={`badge lg tone-${LEAVE_STATUS[l.status].tone}`}>{LEAVE_STATUS[l.status].label}</span>
            {l.area && <span className="badge lg tone-gray">{l.area.name}</span>}
          </div>
          <dl className="data-list">
            <div>
              <dt>Desde</dt>
              <dd>{fmtDayFull(l.startDate)}</dd>
            </div>
            <div>
              <dt>Hasta</dt>
              <dd>{fmtDayFull(l.endDate)}</dd>
            </div>
            {l.type !== 'MEDICAL' && (
              <>
                <div>
                  <dt>Remunerado</dt>
                  <dd>{l.paid ? 'Sí' : 'No'}</dd>
                </div>
                <div>
                  <dt>¿Regresa a la empresa?</dt>
                  <dd>{l.willReturn ? 'Sí' : 'No'}</dd>
                </div>
                {l.departureTime && (
                  <div>
                    <dt>Hora de salida</dt>
                    <dd>{l.departureTime}</dd>
                  </div>
                )}
                {l.returnTime && (
                  <div>
                    <dt>Hora de regreso</dt>
                    <dd>{l.returnTime}</dd>
                  </div>
                )}
              </>
            )}
            <div className="full">
              <dt>Descripción</dt>
              <dd>{l.description}</dd>
            </div>
            {l.additionalReason && (
              <div className="full">
                <dt>Razón adicional</dt>
                <dd>{l.additionalReason}</dd>
              </div>
            )}
          </dl>
          {l.documents.length > 0 && (
            <div>
              <div className="label" style={{ marginBottom: 6 }}>{l.type === 'MEDICAL' ? 'Documentos de la incapacidad' : 'Soportes'}</div>
              <AttachmentList files={l.documents as FileValue[]} />
            </div>
          )}
          {l.decidedBy && (
            <div className="small" style={{ padding: '10px 12px', borderRadius: 12, background: 'var(--card-2)' }}>
              <b>{l.status === 'APPROVED' ? 'Aprobado' : 'Resuelto'} por {l.decidedBy.name}</b> · {fmtDateTime(l.decidedAt)}
              {l.decisionNote && <div className="muted" style={{ marginTop: 4 }}>{l.decisionNote}</div>}
            </div>
          )}

          {l.permissions.canDecide && (
            <div className="field">
              <label>Comentario (obligatorio si rechazas)</label>
              <textarea className="textarea" style={{ minHeight: 70 }} value={note} onChange={(e) => setNote(e.target.value)} />
              <div className="row" style={{ justifyContent: 'flex-end' }}>
                <button className="btn danger" disabled={busy || !note.trim()} onClick={() => act('reject')}>
                  <X /> Rechazar
                </button>
                <button className="btn success" disabled={busy} onClick={() => act('approve')}>
                  <Check /> Aprobar
                </button>
              </div>
            </div>
          )}
          {l.permissions.canCancel && (
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn outline" disabled={busy} onClick={() => act('cancel')}>
                Cancelar mi solicitud
              </button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

// ------------------------------------------------------------------ nueva solicitud
function LeaveForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const today = todayYmd();
  const [f, setF] = useState({
    type: 'PERSONAL' as LeaveType,
    areaId: user?.memberships[0]?.area.id || '',
    startDate: today,
    endDate: today,
    paid: null as boolean | null,
    willReturn: null as boolean | null,
    departureTime: '',
    returnTime: '',
    description: '',
    additionalReason: '',
  });
  const [documents, setDocuments] = useState<FileValue[]>([]);
  const [busy, setBusy] = useState(false);

  const medical = f.type === 'MEDICAL';
  const sameDay = f.startDate === f.endDate;
  const problem = (() => {
    if (!f.startDate || !f.endDate) return 'Indica las fechas';
    if (f.endDate < f.startDate) return 'La fecha fin no puede ser anterior al inicio';
    if (f.description.trim().length < 5) return 'Describe el motivo';
    if (medical) return documents.length ? '' : 'Adjunta los documentos de la incapacidad';
    if (f.paid === null) return 'Indica si es remunerado';
    if (f.willReturn === null) return 'Indica si regresas a la empresa';
    if (f.willReturn) {
      if (!f.departureTime || !f.returnTime) return 'Indica la hora de salida y de regreso';
      if (sameDay && f.returnTime <= f.departureTime) return 'La hora de regreso debe ser posterior a la de salida';
    }
    return '';
  })();

  const save = async () => {
    setBusy(true);
    try {
      await api.post('/leaves', {
        type: f.type,
        areaId: f.areaId || undefined,
        startDate: f.startDate,
        endDate: f.endDate,
        description: f.description,
        additionalReason: f.additionalReason || undefined,
        documents,
        ...(medical ? {} : { paid: f.paid, willReturn: f.willReturn, departureTime: f.departureTime || undefined, returnTime: f.willReturn ? f.returnTime || undefined : undefined }),
      });
      toast('Solicitud enviada. Tu líder fue notificado.');
      onSaved();
      onClose();
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const yesNo = (label: string, value: boolean | null, set: (v: boolean) => void) => (
    <div className="field">
      <label>{label}</label>
      <div className="options-grid">
        {[true, false].map((v) => (
          <label key={String(v)} className={`opt-pill ${value === v ? 'on' : ''}`}>
            <input type="radio" checked={value === v} onChange={() => set(v)} /> {v ? 'Sí' : 'No'}
          </label>
        ))}
      </div>
    </div>
  );

  return (
    <Modal
      title="Nuevo permiso"
      subtitle="Tu líder lo recibe como notificación y debe aprobarlo."
      icon={<CalendarOff />}
      wide
      onClose={onClose}
      footer={
        <>
          {problem && <span className="small faint" style={{ marginRight: 'auto', alignSelf: 'center' }}>{problem}</span>}
          <button className="btn outline" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" disabled={busy || !!problem} onClick={save}>
            Enviar solicitud
          </button>
        </>
      }
    >
      <div className="form-grid">
        <div className="field">
          <label>Tipo de permiso</label>
          <select className="select" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as LeaveType })}>
            {LEAVE_TYPES.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
          <span className="help">{LEAVE_TYPES.find((t) => t.key === f.type)?.hint}</span>
        </div>
        {(user?.memberships.length ?? 0) > 1 ? (
          <div className="field">
            <label>Área que lo aprueba</label>
            <select className="select" value={f.areaId} onChange={(e) => setF({ ...f, areaId: e.target.value })}>
              {user!.memberships.map((m) => (
                <option key={m.area.id} value={m.area.id}>
                  {m.area.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div />
        )}
        <div className="field">
          <label>Fecha de inicio</label>
          <input className="input" type="date" min={medical ? undefined : today} value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value, endDate: e.target.value > f.endDate ? e.target.value : f.endDate })} />
        </div>
        <div className="field">
          <label>Fecha de fin</label>
          <input className="input" type="date" min={f.startDate} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
        </div>

        {medical ? (
          <div className="field full">
            <label>
              Documentos de la incapacidad <span className="req">*</span>
            </label>
            <div className="small badge tone-blue" style={{ height: 'auto', padding: '8px 12px', borderRadius: 12, whiteSpace: 'normal', marginBottom: 6 }}>
              <FileHeart /> Sube la incapacidad expedida por tu EPS o médico (PDF o imagen). Sin ella no se puede enviar la solicitud.
            </div>
            <FileUpload value={documents} onChange={setDocuments} />
          </div>
        ) : (
          <>
            {yesNo('¿Es remunerado?', f.paid, (v) => setF({ ...f, paid: v }))}
            {yesNo('¿Regresarás a la empresa?', f.willReturn, (v) => setF({ ...f, willReturn: v, ...(v ? {} : { returnTime: '' }) }))}
            {f.willReturn && (
              <>
                <div className="field">
                  <label>Hora de salida</label>
                  <input className="input" type="time" value={f.departureTime} onChange={(e) => setF({ ...f, departureTime: e.target.value })} />
                </div>
                <div className="field">
                  <label>Hora de regreso</label>
                  <input className="input" type="time" value={f.returnTime} onChange={(e) => setF({ ...f, returnTime: e.target.value })} />
                </div>
              </>
            )}
          </>
        )}

        <div className="field full">
          <label>
            Descripción <span className="req">*</span>
          </label>
          <textarea className="textarea" style={{ minHeight: 80 }} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Cuéntale a tu líder el motivo" />
        </div>
        <div className="field full">
          <label>Razón adicional (opcional)</label>
          <textarea className="textarea" style={{ minHeight: 64 }} value={f.additionalReason} onChange={(e) => setF({ ...f, additionalReason: e.target.value })} />
        </div>
        {!medical && (
          <div className="field full">
            <label>Soportes (opcional)</label>
            <FileUpload value={documents} onChange={setDocuments} />
          </div>
        )}
      </div>
    </Modal>
  );
}
