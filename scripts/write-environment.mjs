/**
 * Gera `src/environments/environment.ts` a partir de variáveis de ambiente quando ele não existe
 * (ex.: build na Vercel, onde o arquivo não vem do Git). Localmente o arquivo existente é mantido.
 *
 * Variáveis: GOOGLE_CLIENT_ID (login com Google) e GOOGLE_FONTS_API_KEY (opcional).
 */
import { existsSync, writeFileSync } from 'node:fs';

const target = new URL('../src/environments/environment.ts', import.meta.url);

if (existsSync(target) && !process.env.VERCEL) {
  console.log('[env] environment.ts já existe; mantido.');
} else {
  const environment = {
    googleClientId: process.env.GOOGLE_CLIENT_ID ?? '',
    googleFontsApiKey: process.env.GOOGLE_FONTS_API_KEY ?? '',
  };
  writeFileSync(target, `// Gerado por scripts/write-environment.mjs — não edite.\nexport const environment = ${JSON.stringify(environment, null, 2)};\n`);
  if (!environment.googleClientId) console.warn('[env] GOOGLE_CLIENT_ID não definido: o login com Google ficará desativado.');
  console.log('[env] environment.ts gerado a partir das variáveis de ambiente.');
}
