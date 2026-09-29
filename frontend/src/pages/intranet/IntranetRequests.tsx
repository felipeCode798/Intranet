import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Clock, Globe, Send, UserCheck, UserPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { DynamicForm, validateForm } from '../../components/DynamicForm';
import { RequestDetail } from '../../components/RequestDetail';
import { Loading, PriorityBadge, SlaBadge, StatusBadge, useToast } from '../../components/ui';
import { useCompany } from '../../layouts/IntranetLayout';
import { api, errorMessage } from '../../lib/api';
import { fmtDate, PRIORITY, STATUS } from '../../lib/format';
import { Icon } from '../../lib/icons';
import type { Priority, RequestForm, RequestStatus } from '../../lib/types';
import { useMyRequests } from './IntranetHome';

export function RequestCatalog() {
  const company = useCompany();
  const loc = useLocation();
  useEffect(() => {
    if (loc.hash) setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 80);
  }, [loc.hash]);
  const areas = company.areas.filter((a) => a.forms.length);

  return (
    <>
      <div className="phero">
        <div className="ph-icon">
          <ClipboardList />
        </div>
        <h1>
          Solicitudes <br />
          <em>a las áreas</em>
        </h1>
        <p>Elige el área y el tipo de solicitud. Cada una tiene su propio formulario y un plazo de respuesta en días hábiles.</p>
        <div className="chips">
          <span className="chip"><Send />Radicación</span>
          <span className="chip"><UserPlus />Asignación</span>
          <span className="chip"><UserCheck />Aceptación</span>
          <span className="chip"><CheckCircle2 />Respuesta</span>
        </div>
      </div>
      <div className="area-cards" style={{ marginTop: 20 }}>
        {areas.map((a) => (
          <div key={a.id} id={a.id} className="icard area-card">
            <div className="top">
              <span className="i-ico">
                <Icon name={a.icon} />
              </span>
              <div>
                <b>{a.name}</b>
                <small>{a.leaders.length ? `Líder: ${a.leaders.map((l) => l.name).join(', ')}` : 'Área del holding'}</small>
              </div>
              {a.isShared && (
                <span className="shared-tag" style={{ marginLeft: 'auto' }}>
                  <Globe /> Compartida
                </span>
              )}
            </div>
            {a.description && <p className="small" style={{ color: 'var(--i-ink-2)' }}>{a.description}</p>}
            {a.forms.map((f) => (
              <Link key={f.id} className="form-link" to={`/intranet/${company.slug}/solicitudes/nueva/${f.id}`}>
                <span className="i-ico" style={{ width: 36, height: 36 }}>
                  <Icon name={f.icon} size={17} />
                </span>
                <span>
                  <b>{f.name}</b>
                  <small>
                    <Clock size={11} style={{ verticalAlign: '-1px' }} /> Respuesta en {f.slaDays} día(s) hábil(es)
                  </small>
                </span>
                <ArrowRight className="arrow" />
              </Link>
            ))}
          </div>
        ))}
      </div>
      {!areas.length && <div className="icard" style={{ marginTop: 20 }}>Aún no hay tipos de solicitud publicados para {company.name}.</div>}
    </>
  );
}

export function NewRequest() {
  const { formId = '' } = useParams();
  const company = useCompany();
  const nav = useNavigate();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: form, isLoading } = useQuery({ queryKey: ['form', formId], queryFn: async () => (await api.get<RequestForm>(`/forms/${formId}`)).data });
  const [subject, setSubject] = useState('');
  const [priority, setPriority] = useState<Priority | ''>('');
  const [values, setValues] = useState<Record<string, any>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  if (isLoading) return <Loading />;
  if (!form) return <div className="icard">Formulario no encontrado.</div>;

  const submit = async () => {
    const errs = validateForm(form.fields, values);
    if (subject.trim().length < 4) errs.__subject = 'Escribe un asunto (mínimo 4 caracteres)';
    setErrors(errs);
    if (Object.keys(errs).length) return toast('Revisa los campos marcados', 'error');
    setBusy(true);
    try {
      const { data } = await api.post('/requests', { formId, subject, data: values, priority: priority || undefined, companyId: company.id });
      toast(`Solicitud ${data.code} radicada`);
      qc.invalidateQueries({ queryKey: ['requests'] });
      nav(`/intranet/${company.slug}/solicitudes/${data.id}`);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="row" style={{ marginTop: 16 }}>
        <Link className="ibtn ghost" to={`/intranet/${company.slug}/solicitudes`}>
          <ArrowLeft /> Volver al catálogo
        </Link>
      </div>
      <div className="req-form-wrap" style={{ marginTop: 16 }}>
        <div className="icard">
          <div className="proc-head">
            <span className="i-ico">
              <Icon name={form.icon} />
            </span>
            <div>
              <span className="eyebrow">{form.area?.name}</span>
              <div className="sec-title">{form.name}</div>
              {form.description && <div className="sec-sub">{form.description}</div>}
            </div>
          </div>
          <div className="form-grid" style={{ marginTop: 22 }}>
            <div className="field full">
              <label htmlFor="subject">
                Asunto<span className="req">*</span>
              </label>
              <input id="subject" className="input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Resume tu solicitud en una frase" />
              {errors.__subject && <span className="err">{errors.__subject}</span>}
            </div>
            <div className="field">
              <label>Prioridad</label>
              <select className="select" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
                <option value="">Predeterminada ({PRIORITY[form.defaultPriority].label})</option>
                {(Object.keys(PRIORITY) as Priority[]).map((p) => (
                  <option key={p} value={p}>
                    {PRIORITY[p].label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="divider" />
          <DynamicForm fields={form.fields} values={values} onChange={setValues} errors={errors} />
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 24 }}>
            <button className="ibtn" onClick={submit} disabled={busy}>
              <Send /> {busy ? 'Enviando…' : 'Radicar solicitud'}
            </button>
          </div>
        </div>
        <div className="stack" style={{ gap: 16 }}>
          <div className="icard">
            <div className="sec-title" style={{ fontSize: 17 }}>Plazo de atención</div>
            <div className="row" style={{ marginTop: 12, gap: 14 }}>
              <span className="i-ico">
                <Clock />
              </span>
              <div>
                <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--brand)', lineHeight: 1 }}>{form.slaDays}</div>
                <small style={{ color: 'var(--i-ink-3)' }}>día(s) hábil(es) desde la radicación</small>
              </div>
            </div>
            <div className="note">
              <AlertTriangle />
              <div>El plazo empieza a contar una vez radiques la solicitud con toda la información requerida.</div>
            </div>
          </div>
          <div className="icard">
            <div className="sec-title" style={{ fontSize: 17 }}>Así avanza tu solicitud</div>
            <div className="steps" style={{ marginTop: 12 }}>
              {[
                ['Radicación', 'Recibes un correo de confirmación.'],
                ['Asignación', `El líder de ${form.area?.name} la asigna a un responsable.`],
                ['Aceptación y gestión', 'El responsable la acepta y trabaja en ella.'],
                ['Respuesta', 'Recibes la respuesta con los adjuntos por correo.'],
              ].map(([t, d], i) => (
                <div className="doc-item" key={t} style={{ marginTop: 0 }}>
                  <span className="i-ico">{i + 1}</span>
                  <span>
                    <b>{t}</b>
                    <small>{d}</small>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export function MyRequests() {
  const company = useCompany();
  const nav = useNavigate();
  const [status, setStatus] = useState<'open' | RequestStatus | ''>('open');
  const { data, isLoading } = useMyRequests(100);
  const items = (data?.items || []).filter((r) =>
    status === 'open' ? !['RESOLVED', 'CANCELLED'].includes(r.status) : status ? r.status === status : true,
  );
  return (
    <>
      <div className="phero">
        <div className="ph-icon">
          <ClipboardList />
        </div>
        <h1>
          Mis <em>solicitudes</em>
        </h1>
        <p>Consulta el estado, el responsable y la fecha límite de cada solicitud que has radicado.</p>
      </div>
      <div className="icard" style={{ marginTop: 20 }}>
        <div className="row between wrap" style={{ marginBottom: 16 }}>
          <div className="tabs">
            <button className={status === 'open' ? 'on' : ''} onClick={() => setStatus('open')}>Abiertas</button>
            <button className={status === 'RESOLVED' ? 'on' : ''} onClick={() => setStatus('RESOLVED')}>Respondidas</button>
            <button className={status === '' ? 'on' : ''} onClick={() => setStatus('')}>Todas</button>
          </div>
          <Link className="ibtn" to={`/intranet/${company.slug}/solicitudes`}>
            <Send /> Nueva solicitud
          </Link>
        </div>
        {isLoading ? (
          <Loading />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Asunto</th>
                  <th>Área</th>
                  <th>Estado</th>
                  <th>Responsable</th>
                  <th>Prioridad</th>
                  <th>Fecha límite</th>
                </tr>
              </thead>
              <tbody>
                {items.map((r) => (
                  <tr key={r.id} className={`clickable ${r.isOverdue ? 'overdue' : ''}`} onClick={() => nav(`/intranet/${company.slug}/solicitudes/${r.id}`)}>
                    <td className="bold">{r.code}</td>
                    <td>
                      <div className="bold">{r.subject}</div>
                      <div className="xs faint">{r.form.name} · {fmtDate(r.createdAt)}</div>
                    </td>
                    <td>{r.area.name}</td>
                    <td><StatusBadge status={r.status} /></td>
                    <td>{r.assignee?.name || <span className="faint">Sin asignar</span>}</td>
                    <td><PriorityBadge priority={r.priority} /></td>
                    <td><SlaBadge r={r} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!items.length && <div className="empty small">No hay solicitudes {status === 'open' ? 'abiertas' : status ? STATUS[status].label.toLowerCase() : ''}.</div>}
          </div>
        )}
      </div>
    </>
  );
}

export function IntranetRequestPage() {
  const { id = '' } = useParams();
  const company = useCompany();
  return (
    <>
      <div className="row" style={{ margin: '16px 0' }}>
        <Link className="ibtn ghost" to={`/intranet/${company.slug}/mis-solicitudes`}>
          <ArrowLeft /> Mis solicitudes
        </Link>
      </div>
      <RequestDetail id={id} />
    </>
  );
}
