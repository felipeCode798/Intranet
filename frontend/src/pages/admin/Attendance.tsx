import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarOff, CheckCircle2, Clock, Fingerprint, LogIn, LogOut, Mail, RefreshCw, ShieldCheck, Timer, UserX } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Avatar, Empty, Loading, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import { fmtTime } from '../../lib/format';
import { fmtDayFull, shiftLabel, todayYmd } from '../../lib/schedule';
import type { Area, AttendanceMe, AttendanceTeamRow } from '../../lib/types';

const PUNCT: Record<string, { label: string; tone: string }> = {
  ON_TIME: { label: 'A tiempo', tone: 'green' },
  LATE: { label: 'Tarde', tone: 'amber' },
  EARLY_LEAVE: { label: 'Salida anticipada', tone: 'amber' },
  NO_SCHEDULE: { label: 'Sin horario', tone: 'gray' },
  REST_DAY: { label: 'Día de descanso', tone: 'gray' },
};

const STATUS: Record<AttendanceTeamRow['status'], { label: string; tone: string }> = {
  PRESENT: { label: 'Presente', tone: 'green' },
  LATE: { label: 'Llegó tarde', tone: 'amber' },
  ABSENT: { label: 'Sin registro', tone: 'red' },
  LEAVE: { label: 'Con permiso', tone: 'blue' },
  INCOMPLETE: { label: 'Sin salida', tone: 'rose' },
};

export const hoursText = (min: number) => (min ? `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')} min` : '—');

export default function Attendance() {
  const { isLeader, isCompanyAdmin } = useAuth();
  const [tab, setTab] = useState<'me' | 'team'>('me');
  const canTeam = isLeader || isCompanyAdmin;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Asistencia</h1>
          <p className="page-sub">Registra tu entrada y salida con un código de un solo uso que llega a tu correo.</p>
        </div>
        {canTeam && (
          <div className="tabs">
            <button className={tab === 'me' ? 'on' : ''} onClick={() => setTab('me')}>
              Mi asistencia
            </button>
            <button className={tab === 'team' ? 'on' : ''} onClick={() => setTab('team')}>
              Equipo
            </button>
          </div>
        )}
      </div>
      {tab === 'me' ? <MyAttendance /> : <TeamAttendance />}
    </>
  );
}

// ------------------------------------------------------------------ mi asistencia
function useNow(everyMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

interface CodeSent {
  sentTo?: string;
  expiresAt: string;
  resendAt: string;
  attemptsLeft: number;
}

function MyAttendance() {
  const qc = useQueryClient();
  const toast = useToast();
  const now = useNow();
  const { data, isLoading } = useQuery({ queryKey: ['attendance', 'me'], queryFn: async () => (await api.get<AttendanceMe>('/attendance/me')).data });
  const [sent, setSent] = useState<CodeSent | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'send' | 'verify' | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  if (isLoading || !data) return <Loading />;

  // Puede haber un código vigente de una visita anterior a esta página
  const pending: CodeSent | null = data.pendingCode ? { ...sent, ...data.pendingCode } : sent;
  const expired = !!pending && new Date(pending.expiresAt).getTime() <= now;
  const active = pending && !expired ? pending : null;
  const wait = active ? Math.max(0, Math.ceil((new Date(active.resendAt).getTime() - now) / 1000)) : 0;
  const left = active ? Math.max(0, Math.floor((new Date(active.expiresAt).getTime() - now) / 1000)) : 0;
  const entering = data.nextType === 'CHECK_IN';

  const send = async () => {
    setBusy('send');
    setError('');
    try {
      const { data: r } = await api.post<CodeSent>('/attendance/code');
      setSent(r);
      setCode('');
      qc.invalidateQueries({ queryKey: ['attendance', 'me'] });
      toast(`Te enviamos un código a ${r.sentTo}`);
      setTimeout(() => input.current?.focus(), 50);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    setBusy('verify');
    setError('');
    try {
      const { data: r } = await api.post<{ message: string }>('/attendance/verify', { code });
      toast(r.message);
      setSent(null);
      setCode('');
      qc.invalidateQueries({ queryKey: ['attendance'] });
    } catch (e) {
      setError(errorMessage(e));
      setCode('');
      qc.invalidateQueries({ queryKey: ['attendance', 'me'] });
      if (/solicita un código nuevo|No hay un código/i.test(errorMessage(e))) setSent(null);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', alignItems: 'start' }}>
      <div className="card">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <span className="ico-box lg">{entering ? <LogIn /> : <LogOut />}</span>
          <div style={{ flex: 1 }}>
            <div className="xs faint">{fmtDayFull(data.today)}</div>
            <h2 style={{ fontSize: 26, fontWeight: 700 }}>{new Date(now).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'America/Bogota' })}</h2>
            <div className="small muted">
              Horario de hoy: <b>{data.schedule ? shiftLabel(data.schedule) : 'Sin horario asignado'}</b>
            </div>
          </div>
        </div>

        <div className="divider" />

        {!active ? (
          <>
            <p className="small muted">
              {entering ? 'Aún no has registrado tu entrada.' : `Entrada registrada a las ${fmtTime(data.openSince)} · cuando termines, registra la salida.`}
            </p>
            <button className="btn lg block mt-sm" onClick={send} disabled={busy === 'send'}>
              <Mail /> {busy === 'send' ? 'Enviando…' : `Enviar código para registrar la ${entering ? 'entrada' : 'salida'}`}
            </button>
            <p className="xs faint mt-sm">
              <ShieldCheck size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> El código es personal: llega solo a tu correo y solo sirve con tu sesión. Vence en {data.config.codeTtlMinutes} minutos.
            </p>
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (code.length === 6) verify();
            }}
          >
            <div className="field">
              <label htmlFor="att-code">Código de 6 dígitos {active.sentTo ? `enviado a ${active.sentTo}` : 'enviado a tu correo'}</label>
              <input
                id="att-code"
                ref={input}
                className="input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                style={{ height: 60, fontSize: 30, letterSpacing: '.5em', textAlign: 'center', fontWeight: 700 }}
                autoFocus
              />
            </div>
            <div className="row between small" style={{ marginTop: 8 }}>
              <span className="faint">
                <Timer size={13} style={{ display: 'inline', verticalAlign: '-2px' }} /> Vence en {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
              </span>
              <span className="faint">{active.attemptsLeft} intento(s)</span>
            </div>
            <button className="btn lg block mt-sm" disabled={code.length !== 6 || busy === 'verify'}>
              <Fingerprint /> {busy === 'verify' ? 'Verificando…' : `Confirmar ${entering ? 'entrada' : 'salida'}`}
            </button>
            <button type="button" className="btn ghost block mt-sm" disabled={wait > 0 || busy === 'send'} onClick={send}>
              <RefreshCw /> {wait > 0 ? `Reenviar código en ${wait} s` : 'Reenviar código'}
            </button>
          </form>
        )}
        {error && (
          <div className="badge tone-red lg" role="alert" style={{ height: 'auto', padding: '8px 12px', borderRadius: 12, marginTop: 12, whiteSpace: 'normal' }}>
            {error}
          </div>
        )}
        {expired && !error && <div className="small faint mt-sm">El código venció. Pide uno nuevo.</div>}

        {data.todayRecords.length > 0 && (
          <>
            <div className="divider" />
            <div className="stack" style={{ gap: 8 }}>
              {data.todayRecords.map((r) => (
                <div key={r.id} className="row between" style={{ padding: '8px 12px', borderRadius: 12, background: 'var(--card-2)' }}>
                  <span className="row small bold">
                    {r.type === 'CHECK_IN' ? <LogIn size={15} /> : <LogOut size={15} />} {r.type === 'CHECK_IN' ? 'Entrada' : 'Salida'} · {fmtTime(r.at)}
                  </span>
                  {r.punctuality && <span className={`badge tone-${PUNCT[r.punctuality]?.tone ?? 'gray'}`}>{PUNCT[r.punctuality]?.label ?? r.punctuality}{r.deviationMinutes ? ` · ${r.deviationMinutes} min` : ''}</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="card">
        <div className="card-h">
          <h3>Últimos 30 días</h3>
        </div>
        {data.history.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Día</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Horas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.history.map((d) => (
                  <tr key={d.date}>
                    <td>{fmtDayFull(d.date)}</td>
                    <td>{fmtTime(d.firstIn) || '—'}</td>
                    <td>{d.open ? <span className="badge tone-blue">En curso</span> : fmtTime(d.lastOut) || '—'}</td>
                    <td>{hoursText(d.workedMinutes)}</td>
                    <td>
                      <div className="row wrap" style={{ gap: 4 }}>
                        {d.punctuality && <span className={`badge tone-${PUNCT[d.punctuality]?.tone ?? 'gray'}`}>{PUNCT[d.punctuality]?.label}</span>}
                        {d.earlyLeave && <span className="badge tone-amber">Salida anticipada</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Todavía no tienes registros" icon={<Clock />} />
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ equipo
function TeamAttendance() {
  const { isSuper, isCompanyAdmin, leaderAreaIds } = useAuth();
  const [from, setFrom] = useState(todayYmd());
  const [to, setTo] = useState(todayYmd());
  const [areaId, setAreaId] = useState('');
  const { data: areas = [] } = useQuery({
    queryKey: ['areas', isSuper || isCompanyAdmin ? 'all' : 'mine'],
    queryFn: async () => (await api.get<Area[]>(isSuper || isCompanyAdmin ? '/areas' : '/areas/mine')).data,
  });
  const options = areas.filter((a) => isSuper || isCompanyAdmin || leaderAreaIds.includes(a.id));
  const { data, isLoading, error } = useQuery({
    queryKey: ['attendance', 'team', from, to, areaId],
    queryFn: async () => (await api.get<{ rows: AttendanceTeamRow[]; people: number }>('/attendance/team', { params: { from, to, areaId: areaId || undefined } })).data,
  });
  const rows = data?.rows ?? [];
  const count = (s: AttendanceTeamRow['status'][]) => rows.filter((r) => s.includes(r.status)).length;

  return (
    <>
      <div className="filters" style={{ marginBottom: 16 }}>
        <div className="field">
          <label>Desde</label>
          <input className="input sm" type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div className="field">
          <label>Hasta</label>
          <input className="input sm" type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div className="field">
          <label>Área</label>
          <select className="select sm" value={areaId} onChange={(e) => setAreaId(e.target.value)}>
            <option value="">Todas</option>
            {options.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="kpis" style={{ marginBottom: 20 }}>
        <div className="kpi">
          <small>
            <CheckCircle2 /> Presentes
          </small>
          <div className="v">{count(['PRESENT', 'LATE', 'INCOMPLETE'])}</div>
        </div>
        <div className="kpi">
          <small>
            <AlertTriangle /> Llegaron tarde
          </small>
          <div className="v">{count(['LATE'])}</div>
        </div>
        <div className="kpi">
          <small>
            <UserX /> Sin registro
          </small>
          <div className="v" style={{ color: count(['ABSENT']) ? 'var(--critical)' : undefined }}>
            {count(['ABSENT'])}
          </div>
        </div>
        <div className="kpi">
          <small>
            <CalendarOff /> Con permiso
          </small>
          <div className="v">{count(['LEAVE'])}</div>
        </div>
      </div>

      <div className="card">
        {isLoading ? (
          <Loading />
        ) : error ? (
          <Empty title="No se pudo cargar la asistencia" text={errorMessage(error)} />
        ) : rows.length ? (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Persona</th>
                  <th>Día</th>
                  <th>Horario</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Horas</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.userId}${r.date}`}>
                    <td>
                      <div className="row">
                        <Avatar name={r.name} url={r.avatarUrl} size="sm" />
                        <div>
                          <div className="bold">{r.name}</div>
                          <div className="xs faint">{r.jobTitle}</div>
                        </div>
                      </div>
                    </td>
                    <td>{fmtDayFull(r.date)}</td>
                    <td>{r.scheduled ? shiftLabel({ isRest: false, startTime: r.scheduled.start, endTime: r.scheduled.end }) : '—'}</td>
                    <td>{fmtTime(r.firstIn) || '—'}</td>
                    <td>{r.open ? <span className="badge tone-blue">En curso</span> : fmtTime(r.lastOut) || '—'}</td>
                    <td>{hoursText(r.workedMinutes)}</td>
                    <td>
                      <div className="row wrap" style={{ gap: 4 }}>
                        <span className={`badge tone-${STATUS[r.status].tone}`}>{STATUS[r.status].label}</span>
                        {r.earlyLeave && <span className="badge tone-amber">Salida anticipada</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty title="Sin registros en este rango" text="Solo aparecen personas con registro, con turno asignado o con permiso aprobado." icon={<Clock />} />
        )}
      </div>
    </>
  );
}
