// Carga la documentación del SGI en las intranets de Playtech, Enigma, ORCA IT y TuCompra
// usando el API (no toca la base de datos directamente).
//
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/importar-documentos/importar.mjs            → simulación, no escribe nada
//   ADMIN_EMAIL=... ADMIN_PASSWORD=... node scripts/importar-documentos/importar.mjs --aplicar  → crea empresas y documentos
//
// Variables: API_URL (por defecto https://intranetplay.duckdns.org/api), ADMIN_EMAIL, ADMIN_PASSWORD (superadministrador).
// Es idempotente: solo agrega los documentos cuyo par título + enlace aún no existe en la empresa.
// Los datos salen de documentos.json (generado a partir de las hojas Documentos_*_Links_SharePoint y de intranetucompra.pages.dev).

import { readFileSync } from 'fs';

const API = (process.env.API_URL || 'https://intranetplay.duckdns.org/api').replace(/\/$/, '');
const APPLY = process.argv.includes('--aplicar');
const DATA = JSON.parse(readFileSync(new URL('./documentos.json', import.meta.url), 'utf8'));

/** Empresas que se crean si no existen. Playtech y TuCompra deben existir ya. */
const NEW_COMPANIES = {
  enigma: {
    name: 'Enigma',
    slug: 'enigma',
    legalName: 'ENIGMA DEVELOPERS S.A.S. BIC',
    primaryColor: '#0f766e',
    secondaryColor: '#5eead4',
    managementSystem: 'NTC ISO 9001:2015',
  },
  orca: {
    name: 'ORCA IT',
    slug: 'orca',
    legalName: 'ORCA IT',
    description: 'Gestión de infraestructura IT del Grupo Playtech.',
    primaryColor: '#0b3a5b',
    secondaryColor: '#38bdf8',
  },
};

let token = '';
async function api(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : null;
}

const key = (d) => `${d.title.trim().toLowerCase()}|${d.url.trim()}`;

async function main() {
  const { ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD (superadministrador).');
  console.log(`API: ${API} · modo: ${APPLY ? 'APLICAR' : 'simulación (usa --aplicar para escribir)'}`);

  ({ token } = await api('POST', '/auth/login', { email: ADMIN_EMAIL, password: ADMIN_PASSWORD }));
  const companies = await api('GET', '/companies');
  const sharedAreaIds = (await api('GET', '/areas')).filter((a) => a.isShared && a.active !== false).map((a) => a.id);

  for (const [slug, docs] of Object.entries(DATA)) {
    let company = companies.find((c) => c.slug === slug);
    if (!company) {
      const def = NEW_COMPANIES[slug];
      if (!def) {
        console.warn(`\n[${slug}] no existe en producción y no está en la lista de empresas a crear: se omite.`);
        continue;
      }
      console.log(`\n[${slug}] no existe → se crea "${def.name}" con ${sharedAreaIds.length} área(s) compartida(s).`);
      if (!APPLY) {
        console.log(`  ${docs.length} documento(s) por cargar.`);
        continue;
      }
      company = await api('POST', '/companies', { ...def, sharedAreaIds });
    }

    const { documents: current } = await api('GET', `/companies/${company.id}`);
    const existing = new Set(current.map(key));
    const missing = docs.filter((d) => !existing.has(key(d)));
    console.log(`\n[${slug}] ${company.name}: ${current.length} documento(s) actuales, ${missing.length} por agregar de ${docs.length}.`);

    let ok = 0;
    for (const d of missing) {
      if (!APPLY) {
        console.log(`  + [${d.process}] ${d.category} · ${d.title}`);
        continue;
      }
      try {
        await api('POST', `/companies/${company.id}/documents`, d);
        ok++;
      } catch (e) {
        console.error(`  ✗ ${d.title}: ${e.message}`);
      }
    }
    if (APPLY) console.log(`  ✓ ${ok} agregado(s).`);
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
