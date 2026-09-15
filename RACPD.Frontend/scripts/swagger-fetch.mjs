#!/usr/bin/env node
/**
 * Script para descargar y formatear el esquema OpenAPI (swagger.json)
 * desde el backend en desarrollo local.
 *
 * Uso: npm run api:fetch
 */

import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rutaDestino = resolve(__dirname, '..', 'swagger.json');
const urlSwagger = process.env.SWAGGER_URL ?? 'http://localhost:5000/swagger/v1/swagger.json';

console.log(`[api:fetch] Obteniendo esquema OpenAPI desde: ${urlSwagger}...`);

try {
  const respuesta = await fetch(urlSwagger);
  if (!respuesta.ok) {
    throw new Error(`El servidor respondió con código HTTP ${respuesta.status} ${respuesta.statusText}`);
  }

  const json = await respuesta.json();
  const contenidoFormateado = JSON.stringify(json, null, 2) + '\n';
  writeFileSync(rutaDestino, contenidoFormateado, 'utf-8');

  console.log(`[api:fetch] ✔ Esquema OpenAPI guardado exitosamente en:\n  -> ${rutaDestino}`);
  console.log('[api:fetch] Ejecuta "npm run api:gen" si deseas regenerar los hooks TypeScript ahora.');
} catch (error) {
  console.error('\n[api:fetch] ✖ Error al descargar el esquema OpenAPI.');
  console.error('Asegúrate de que el Backend esté corriendo en http://localhost:5000 (dotnet run).\n');
  if (error instanceof Error) {
    console.error(`Detalle: ${error.message}`);
  }
  process.exit(1);
}
