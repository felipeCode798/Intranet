/**
 * Genera la paleta de la intranet de cada empresa a partir de su color principal,
 * replicando la estructura de la intranet de referencia (navy profundo + color de marca + acento).
 */
function hexToHsl(hex: string): [number, number, number] {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  const r = ((n >> 16) & 255) / 255,
    g = ((n >> 8) & 255) / 255,
    b = (n & 255) / 255;
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b);
  let hue = 0,
    s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    hue = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    hue *= 60;
  }
  return [hue, s * 100, l * 100];
}

const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(h)} ${Math.round(Math.min(100, s))}% ${Math.round(Math.max(0, Math.min(100, l)))}%)`;

export function companyPalette(primary: string, secondary?: string) {
  const [h, s, l] = hexToHsl(primary || '#1d4ed8');
  const sat = Math.max(45, s);
  return {
    '--brand': primary,
    '--brand-600': hsl(h, sat, Math.min(l + 6, 60)),
    '--brand-dark': hsl(h, sat, Math.max(l - 12, 22)),
    '--navy-900': hsl(h, Math.min(sat, 80), 11),
    '--navy-800': hsl(h, Math.min(sat, 72), 17),
    '--navy-700': hsl(h, Math.min(sat, 65), 25),
    '--neon': secondary || hsl(h + 20, 90, 62),
    '--soft': hsl(h, Math.min(sat, 70), 96),
    '--soft-2': hsl(h, Math.min(sat, 60), 91),
  } as Record<string, string>;
}

export const PRESET_COLORS = ['#1d4ed8', '#5b4ff5', '#7c3aed', '#db2777', '#dc2626', '#d97706', '#65a30d', '#059669', '#0f766e', '#0891b2', '#334155', '#111827'];
