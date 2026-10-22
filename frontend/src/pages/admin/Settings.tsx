import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, LayoutGrid, LogIn, Mail, MailX, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { Loading, Switch, useToast } from '../../components/ui';
import { api, errorMessage } from '../../lib/api';
import type { SettingsOverview } from '../../lib/types';

type Tri = 'inherit' | 'on' | 'off';
const toTri = (v: boolean | null | undefined): Tri => (v === true ? 'on' : v === false ? 'off' : 'inherit');
const fromTri = (v: Tri): boolean | null => (v === 'on' ? true : v === 'off' ? false : null);

export default function Settings() {
  const { refresh } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const [companyId, setCompanyId] = useState('');
  const [busy, setBusy] = useState(false);
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: async () => (await api.get<SettingsOverview>('/settings')).data });

  if (isLoading || !data) return <Loading />;
  const company = data.companies.find((c) => c.id === companyId) ?? data.companies[0];
  const g = data.global;

  const save = async (url: string, body: object, ok: string) => {
    setBusy(true);
    try {
      const { data: next } = await api.put<SettingsOverview>(url, body);
      qc.setQueryData(['settings'], next);
      await refresh(); // el menú del propio superadministrador también cambia
      toast(ok);
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  const effectiveFor = (c: (typeof data.companies)[number], key: string) => c.moduleOverrides[key] ?? g.modules[key] ?? true;
  const effectiveIntranet = (c: (typeof data.companies)[number]) => c.showIntranetOverride ?? g.showIntranetOnLogin;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Configuración avanzada</h1>
          <p className="page-sub">Decide qué módulos ve cada empresa y si, al iniciar sesión, las personas llegan a la intranet o directo al panel.</p>
        </div>
        <span className="badge tone-violet lg">
          <ShieldCheck /> Solo superadministrador
        </span>
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 460px), 1fr))', alignItems: 'start' }}>
        <div className="stack" style={{ gap: 20 }}>
          <div className="card">
            <div className="card-h">
              <h3>Al iniciar sesión</h3>
            </div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="ico-box">
                <LogIn />
              </span>
              <div style={{ flex: 1 }}>
                <b>Mostrar la intranet</b>
                <p className="small muted">
                  {g.showIntranetOnLogin
                    ? 'Después de iniciar sesión las personas llegan a la intranet de su empresa.'
                    : 'Después de iniciar sesión las personas llegan directo al panel (tareas, asistencia, horarios y permisos).'}
                </p>
              </div>
              <Switch on={g.showIntranetOnLogin} onChange={(v) => !busy && save('/settings/global', { showIntranetOnLogin: v }, 'Preferencia guardada')} />
            </div>
            <p className="xs faint mt-sm">Aplica a todo el holding. Cada empresa puede cambiarlo más abajo.</p>
          </div>

          <div className="card" data-tour="settings-email">
            <div className="card-h">
              <h3>Correos</h3>
              <span className={`badge ${g.emailEnabled ? 'tone-green' : 'tone-red'}`}>{g.emailEnabled ? 'Activo' : 'Apagado'}</span>
            </div>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <span className="ico-box">{g.emailEnabled ? <Mail /> : <MailX />}</span>
              <div style={{ flex: 1 }}>
                <b>Enviar correos</b>
                <p className="small muted">
                  {g.emailEnabled
                    ? 'El sistema envía correos de solicitudes, tareas, horarios, permisos y el código de asistencia.'
                    : 'No se envía ningún correo. Las notificaciones dentro de la plataforma siguen funcionando.'}
                </p>
              </div>
              <Switch
                on={g.emailEnabled}
                onChange={(v) => !busy && save('/settings/global', { emailEnabled: v }, v ? 'Envío de correos activado' : 'Envío de correos apagado')}
              />
            </div>
            {!g.emailEnabled && (
              <p className="small badge tone-amber" style={{ height: 'auto', padding: '8px 12px', borderRadius: 12, marginTop: 12, whiteSpace: 'normal' }}>
                Mientras esté apagado, nadie podrá registrar asistencia: el código de verificación se envía por correo.
              </p>
            )}
            <p className="xs faint mt-sm">Aplica a todo el holding. Cada intento queda registrado como “correos apagados” en el seguimiento de la solicitud.</p>
          </div>

          <div className="card" data-tour="settings-modules">
            <div className="card-h">
              <h3>Módulos del holding</h3>
              <span className="xs faint">Se aplican a todas las empresas</span>
            </div>
            <div className="stack" style={{ gap: 0 }}>
              {data.catalog.map((m) => (
                <div key={m.key} className="row" style={{ padding: '14px 0', borderTop: '1px solid var(--line)', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <b className="small">{m.label}</b>
                    <p className="xs faint">{m.description}</p>
                  </div>
                  <Switch on={g.modules[m.key] !== false} onChange={(v) => !busy && save('/settings/global', { modules: { [m.key]: v } }, `${m.label}: ${v ? 'activado' : 'desactivado'}`)} />
                </div>
              ))}
            </div>
            <p className="xs faint mt-sm">Dashboard, notificaciones, perfil, usuarios, áreas, empresas y esta configuración siempre están disponibles.</p>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Personalizar por empresa</h3>
            <Building2 size={18} className="faint" />
          </div>
          {!data.companies.length ? (
            <p className="small faint">Aún no hay empresas.</p>
          ) : (
            <>
              <div className="field">
                <label>Empresa</label>
                <select className="select" value={company.id} onChange={(e) => setCompanyId(e.target.value)}>
                  {data.companies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field mt-sm">
                <label>Al iniciar sesión</label>
                <select
                  className="select"
                  disabled={busy}
                  value={toTri(company.showIntranetOverride)}
                  onChange={(e) => save(`/settings/companies/${company.id}`, { showIntranetOverride: fromTri(e.target.value as Tri) }, 'Preferencia de la empresa guardada')}
                >
                  <option value="inherit">Igual que el holding ({g.showIntranetOnLogin ? 'ver la intranet' : 'ir al panel'})</option>
                  <option value="on">Mostrar la intranet</option>
                  <option value="off">Ir directo al panel</option>
                </select>
              </div>

              <div className="divider" />
              <div className="stack" style={{ gap: 10 }}>
                {data.catalog.map((m) => {
                  const inherited = g.modules[m.key] !== false;
                  return (
                    <div key={m.key} className="row between">
                      <span className="small bold">{m.label}</span>
                      <select
                        className="select sm"
                        style={{ width: 230 }}
                        disabled={busy}
                        value={toTri(company.moduleOverrides[m.key])}
                        onChange={(e) =>
                          save(`/settings/companies/${company.id}`, { moduleOverrides: { [m.key]: fromTri(e.target.value as Tri) } }, `${m.label} en ${company.name} actualizado`)
                        }
                      >
                        <option value="inherit">Heredar ({inherited ? 'activo' : 'inactivo'})</option>
                        <option value="on">Activo</option>
                        <option value="off">Inactivo</option>
                      </select>
                    </div>
                  );
                })}
              </div>

              <div className="divider" />
              <div className="small bold row" style={{ marginBottom: 8 }}>
                <LayoutGrid size={15} /> Resultado para {company.name}
              </div>
              <div className="row wrap" style={{ gap: 6 }}>
                {data.catalog.map((m) => (
                  <span key={m.key} className={`badge ${effectiveFor(company, m.key) ? 'tone-green' : 'tone-gray'}`}>
                    {m.label}
                  </span>
                ))}
              </div>
              <p className="xs faint mt-sm">
                <SlidersHorizontal size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> Al iniciar sesión:{' '}
                <b>{effectiveIntranet(company) && effectiveFor(company, 'intranet') ? 'ven la intranet' : 'van directo al panel'}</b>
              </p>
            </>
          )}
        </div>
      </div>
    </>
  );
}
