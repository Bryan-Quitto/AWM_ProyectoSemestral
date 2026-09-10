#!/usr/bin/env node
// Wrapper multiplataforma para regenerar swagger.json desde RACPD.Backend.
// Ejecuta el backend con --export-swagger en un puerto efímero sin ocupar puertos fijos.

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(__dirname, '..');
const backendProject = resolve(webRoot, '..', 'RACPD.Backend', 'RACPD.Backend.csproj');

const args = [
  'run',
  '--project', backendProject,
  '--no-build',
  '--',
  '--export-swagger'
];

console.log('[swagger:export] Exportando esquema OpenAPI desde RACPD.Backend...');

const child = spawn('dotnet', args, {
  cwd: webRoot,
  stdio: 'inherit',
  env: {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Development',
    DOTNET_ENVIRONMENT: 'Development'
  }
});

child.on('exit', (code) => {
  if (code === 0) {
    console.log('[swagger:export] ✔ Esquema OpenAPI exportado correctamente en swagger.json.');
  }
  process.exit(code ?? 0);
});

child.on('error', (err) => {
  console.error('[swagger:export] No se pudo invocar dotnet. ¿SDK .NET instalado y PATH configurado?');
  console.error(err);
  process.exit(1);
});
