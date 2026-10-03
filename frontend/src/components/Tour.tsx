import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { createContext, Fragment, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { api } from '../lib/api';
import { TOURS, tourKeyFor, type TourCtx } from '../lib/tours';

interface Step {
  tour: string;
  target?: string;
  title: string;
  body: string;
  items?: string[];
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface TourApi {
  /** Inicia los recorridos indicados; sin force solo los que el usuario no ha visto */
  start: (keys: string[], force?: boolean) => void;
  /** Vuelve a mostrar todos los recorridos como la primera vez */
  reset: () => Promise<void>;
  /** Recorrido de la sección actual (null si la ruta no tiene) */
  currentKey: string | null;
}

const Ctx = createContext<TourApi>({ start: () => {}, reset: async () => {}, currentKey: null });
export const useTour = () => useContext(Ctx);

const sel = (target: string) => document.querySelector<HTMLElement>(`[data-tour="${target}"]`);
const isVisible = (el: HTMLElement | null) => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/** Espera a que la página termine de cargar (sin spinners) antes de medir los elementos */
function waitForPage(cancelled: () => boolean) {
  return new Promise<void>((resolve) => {
    const t0 = performance.now();
    let calmSince = 0;
    const tick = () => {
      if (cancelled()) return resolve();
      const main = document.querySelector('.admin-main');
      const busy = !main || !!main.querySelector('.spinner');
      const now = performance.now();
      calmSince = busy ? 0 : calmSince || now;
      if ((calmSince && now - calmSince > 400) || now - t0 > 8000) return resolve();
      setTimeout(tick, 100);
    };
    tick();
  });
}

export function TourProvider({ children }: { children: ReactNode }) {
  const { user, isSuper, isCompanyAdmin, isLeader } = useAuth();
  const { pathname } = useLocation();
  const seen = useRef(new Set(user?.toursSeen || []));
  const runId = useRef(0);
  const [run, setRun] = useState<{ keys: string[]; steps: Step[]; i: number } | null>(null);
  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    seen.current = new Set(user?.toursSeen || []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const ctx: TourCtx = useMemo(
    () => ({ firstName: user?.name.split(' ')[0] || '', isSuper, isCompanyAdmin, isLeader }),
    [user?.name, isSuper, isCompanyAdmin, isLeader],
  );

  const markSeen = useCallback((keys: string[]) => {
    keys.forEach((key) => {
      if (seen.current.has(key)) return;
      seen.current.add(key);
      api.post('/users/me/tours', { key }).catch(() => {
        /* si falla se volverá a mostrar en la próxima sesión */
      });
    });
  }, []);

  const start = useCallback(
    async (keys: string[], force = false) => {
      const id = ++runId.current;
      const todo = keys.filter((k) => TOURS[k] && (force || !seen.current.has(k)));
      setRun(null);
      if (!todo.length) return;
      await waitForPage(() => runId.current !== id);
      if (runId.current !== id) return;
      const val = <T,>(v: T | ((c: TourCtx) => T)) => (typeof v === 'function' ? (v as (c: TourCtx) => T)(ctx) : v);
      const steps: Step[] = todo
        .flatMap((tour) => TOURS[tour].steps.map((s) => ({ ...s, tour })))
        .filter((s) => !s.target || isVisible(sel(s.target)))
        .map((s) => ({ tour: s.tour, target: s.target, placement: s.placement, title: val(s.title), body: val(s.body), items: s.items && val(s.items) }));
      if (!steps.length) return markSeen(todo);
      setRun({ keys: todo, steps, i: 0 });
    },
    [ctx, markSeen],
  );

  const close = useCallback(() => {
    runId.current++;
    if (runRef.current) markSeen(runRef.current.keys);
    setRun(null);
  }, [markSeen]);

  const reset = useCallback(async () => {
    await api.delete('/users/me/tours');
    seen.current.clear();
  }, []);

  // Primera visita a cada sección: recorrido general del panel + el de la sección
  const currentKey = tourKeyFor(pathname);
  useEffect(() => {
    start(['panel', ...(currentKey ? [currentKey] : [])]);
    return () => {
      runId.current++;
    };
  }, [pathname, currentKey, start]);

  const api_ = useMemo(() => ({ start, reset, currentKey }), [start, reset, currentKey]);

  return (
    <Ctx.Provider value={api_}>
      {children}
      {run && (
        <TourOverlay
          steps={run.steps}
          i={run.i}
          onGo={(i) => setRun((r) => (r ? { ...r, i } : r))}
          onClose={close}
        />
      )}
    </Ctx.Provider>
  );
}

// ---------------------------------------------------------------- superposición
type Rect = { top: number; left: number; width: number; height: number };
const PAD = 6;
const GAP = 14;
const MARGIN = 12;

function place(r: Rect | null, w: number, h: number, pref?: Step['placement']) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const clampX = (x: number) => Math.min(Math.max(x, MARGIN), vw - w - MARGIN);
  const clampY = (y: number) => Math.min(Math.max(y, MARGIN), vh - h - MARGIN);
  if (!r) return { left: clampX((vw - w) / 2), top: clampY((vh - h) / 2) };
  const bottom = r.top + r.height + PAD;
  const right = r.left + r.width + PAD;
  const fits = {
    bottom: bottom + GAP + h <= vh - MARGIN,
    top: r.top - PAD - GAP - h >= MARGIN,
    right: right + GAP + w <= vw - MARGIN,
    left: r.left - PAD - GAP - w >= MARGIN,
  };
  const side = ([pref, 'bottom', 'top', 'right', 'left'] as const).find((s) => s && fits[s]);
  const cx = clampX(r.left + r.width / 2 - w / 2);
  const cy = clampY(r.top + r.height / 2 - h / 2);
  if (side === 'bottom') return { left: cx, top: bottom + GAP };
  if (side === 'top') return { left: cx, top: r.top - PAD - GAP - h };
  if (side === 'right') return { left: right + GAP, top: cy };
  if (side === 'left') return { left: r.left - PAD - GAP - w, top: cy };
  // El elemento ocupa casi toda la pantalla: la ventana va abajo, sobre él
  return { left: cx, top: vh - h - MARGIN };
}

/** Texto con **negritas** */
function rich(text: string) {
  return text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : <Fragment key={i}>{part}</Fragment>));
}

function TourOverlay({ steps, i, onGo, onClose }: { steps: Step[]; i: number; onGo: (i: number) => void; onClose: () => void }) {
  const step = steps[i];
  const last = i === steps.length - 1;
  const [rect, setRect] = useState<Rect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const dir = useRef(1);

  const go = useCallback(
    (n: number) => {
      dir.current = n >= i ? 1 : -1;
      if (n >= steps.length) onClose();
      else if (n >= 0) onGo(n);
    },
    [i, steps.length, onGo, onClose],
  );

  // Lleva el elemento a la vista y lo sigue en cada cuadro (scroll, cambios de tamaño, menús fijos)
  useEffect(() => {
    if (!step.target) {
      setRect(null);
      return;
    }
    const el = sel(step.target);
    if (!isVisible(el)) {
      // Desapareció desde que empezó el recorrido: se salta en la misma dirección
      go(i + dir.current);
      return;
    }
    const r0 = el!.getBoundingClientRect();
    if (r0.top < 90 || r0.bottom > window.innerHeight - 20 || r0.left < 0 || r0.right > window.innerWidth) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      el!.scrollIntoView({ block: 'center', inline: 'center', behavior: reduce ? 'auto' : 'smooth' });
    }
    let raf = 0;
    let prev = '';
    const loop = () => {
      const r = el!.getBoundingClientRect();
      const k = `${r.top}|${r.left}|${r.width}|${r.height}`;
      if (k !== prev) {
        prev = k;
        setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useLayoutEffect(() => {
    const p = popRef.current;
    if (!p) return;
    setPos(place(rect, p.offsetWidth, p.offsetHeight, step.placement));
  }, [rect, step]);

  useEffect(() => {
    const onResize = () => popRef.current && setPos(place(rect, popRef.current.offsetWidth, popRef.current.offsetHeight, step.placement));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [rect, step]);

  useEffect(() => {
    nextRef.current?.focus({ preventScroll: true });
  }, [i]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') go(i + 1);
      else if (e.key === 'ArrowLeft') go(i - 1);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, [i, go, onClose]);

  const spot = rect && {
    top: Math.max(rect.top - PAD, 4),
    left: Math.max(rect.left - PAD, 4),
    width: Math.min(rect.width + PAD * 2, window.innerWidth - 8),
    height: Math.min(rect.height + PAD * 2, window.innerHeight - Math.max(rect.top - PAD, 4) - 4),
  };
  const tourName = TOURS[step.tour]?.name;

  return (
    <div className="tour-root">
      <div className="tour-block" onMouseDown={(e) => e.preventDefault()} />
      {spot ? <div className="tour-spot" style={spot} /> : <div className="tour-dim" />}
      <div
        ref={popRef}
        className="tour-pop"
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
        style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}
      >
        <div className="tour-top">
          <span className="tour-chip">{tourName}</span>
          <span className="xs faint">
            {i + 1} de {steps.length}
          </span>
          <button className="icon-btn sm" onClick={onClose} aria-label="Cerrar recorrido">
            <X />
          </button>
        </div>
        <h3 id="tour-title">{step.title}</h3>
        <div id="tour-body">
          <p>{rich(step.body)}</p>
          {step.items && step.items.length > 0 && (
            <ul>
              {step.items.map((t) => (
                <li key={t}>{rich(t)}</li>
              ))}
            </ul>
          )}
        </div>
        <div className="tour-progress" aria-hidden>
          <i style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
        <div className="tour-foot">
          {!last && (
            <button className="tour-skip" onClick={onClose}>
              Omitir recorrido
            </button>
          )}
          <span style={{ flex: 1 }} />
          {i > 0 && (
            <button className="btn sm outline" onClick={() => go(i - 1)}>
              <ArrowLeft /> Anterior
            </button>
          )}
          <button ref={nextRef} className="btn sm" onClick={() => go(i + 1)}>
            {last ? (
              <>
                <Check /> Entendido
              </>
            ) : (
              <>
                Siguiente <ArrowRight />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
