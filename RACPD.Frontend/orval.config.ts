import { defineConfig } from 'orval';

// En entornos locales sin backend activo o en CI/CD (Vercel/GitHub Actions),
// usamos el archivo swagger.json commiteado como Fuente Única de Verdad (SSoT).
// Para actualizar este archivo cuando cambie el backend, ejecutar: npm run api:fetch
const swaggerSource = './swagger.json';

export default defineConfig({
  racpd: {
    input: {
      target: swaggerSource,
    },
    output: {
      mode: 'tags-split',
      target: 'src/api/generated/endpoints.ts',
      schemas: 'src/api/generated/model',
      client: 'swr',
      mock: false,
      // Mutator personalizado que inyecta el Bearer token de Supabase en
      // cada request al backend (ver src/api/custom-fetch.ts).
      override: {
        mutator: {
          path: 'src/api/custom-fetch.ts',
          name: 'customFetch',
        },
      },
    },
  },
});

