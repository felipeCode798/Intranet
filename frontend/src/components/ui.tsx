import { AlertTriangle, CheckCircle2, Clock, Inbox, X } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fileUrl } from '../lib/api';
import { initials, PRIORITY, remaining, STATUS } from '../lib/format';
import type { Priority, RequestItem, RequestStatus } from '../lib/types';

// ---------------------------------------------------------------- avisos
type Toast = { id: number; text: string; kind: 'ok' | 'error' };
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'error') => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setItems((xs) => [...xs, { id, text, kind }]);
    setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast ${t.kind === 'error' ? 'error' : ''}`}>
            {t.kind === 'error' ? <AlertTriangle /> : <CheckCircle2 />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

// ---------------------------------------------------------------- modal
export function Modal({
  title,
  subtitle,
  icon,
  onClose,
  children,
  footer,
  wide,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', k);
    return () => document.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-h">
          {icon && <div className="ico-box">{icon}</div>}
          <div style={{ flex: 1 }}>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button className="icon-btn sm" onClick={onClose} aria-label="Cerrar">
            <X />
          </button>
        </div>
        <div className="modal-b">{children}</div>
        {footer && <div className="modal-f">{footer}</div>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- piezas
export const Spinner = () => <div className="spinner" aria-label="Cargando" />;
export const Loading = () => (
  <div className="center-screen">
    <Spinner />
  </div>
);

export function Empty({ title, text, icon, action }: { title: string; text?: string; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="em-ico">{icon || <Inbox />}</div>
      <b>{title}</b>
      {text && <span className="small">{text}</span>}
      {action}
    </div>
  );
}

const COLORS = ['#6457f5', '#1d4ed8', '#0f766e', '#d97706', '#db2777', '#059669', '#7c3aed', '#0891b2'];
export function Avatar({ name, url, size }: { name?: string | null; url?: string | null; size?: 'sm' | 'lg' }) {
  const color = COLORS[(name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];
  return (
    <span className={`avatar ${size || ''}`} style={{ background: color }} title={name || ''}>
      {url ? <img src={fileUrl(url)} alt="" /> : initials(name)}
    </span>
  );
}

export const StatusBadge = ({ status, lg }: { status: RequestStatus; lg?: boolean }) => (
  <span className={`badge tone-${STATUS[status].tone} ${lg ? 'lg' : ''}`}>{STATUS[status].label}</span>
);

export const PriorityBadge = ({ priority }: { priority: Priority }) => (
  <span className={`badge tone-${PRIORITY[priority].tone}`}>{PRIORITY[priority].label}</span>
);

/** Indicador visual de vencimiento (ícono + texto, nunca solo color) */
export function SlaBadge({ r }: { r: Pick<RequestItem, 'status' | 'isOverdue' | 'remainingMs' | 'resolvedLate' | 'slaProgress'> }) {
  if (r.status === 'RESOLVED')
    return r.resolvedLate ? (
      <span className="badge tone-amber">
        <Clock /> Fuera de plazo
      </span>
    ) : (
      <span className="badge tone-green">
        <CheckCircle2 /> A tiempo
      </span>
    );
  if (r.status === 'CANCELLED') return <span className="badge tone-gray">—</span>;
  if (r.isOverdue)
    return (
      <span className="badge tone-red">
        <AlertTriangle /> {remaining(r.remainingMs)}
      </span>
    );
  return (
    <span className={`badge ${r.slaProgress > 0.75 ? 'tone-amber' : 'tone-teal'}`}>
      <Clock /> {remaining(r.remainingMs)}
    </span>
  );
}

/** Barra de tiempo consumido del ANS (estilo "90% ———" de la referencia) */
export function SlaBar({ progress, done }: { progress: number; done?: boolean }) {
  const pct = Math.round(progress * 100);
  const cls = progress > 1 ? 'late' : progress > 0.75 && !done ? 'warn' : '';
  return (
    <div className={`sla-bar ${cls}`} title={`${pct}% del plazo consumido`}>
      <span className="pct">{pct}%</span>
      <div className="track">
        <div className="fill" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}

/** Anillo de progreso (cumplimiento) */
export function ProgressRing({ pct, size = 64, color }: { pct: number; size?: number; color?: string }) {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const stroke2 = color || (pct >= 80 ? 'var(--good)' : pct >= 60 ? '#d97706' : 'var(--critical)');
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={stroke2}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(100, pct) / 100)}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size / 4.6} fontWeight={700} fill="var(--ink)">
        {pct}%
      </text>
    </svg>
  );
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" className="row" onClick={() => onChange(!on)} aria-pressed={on}>
      <span className={`switch ${on ? 'on' : ''}`} />
      {label && <span className="small">{label}</span>}
    </button>
  );
}
