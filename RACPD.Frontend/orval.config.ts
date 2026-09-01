import { defineConfig } from 'orval';

export default defineConfig({
  racpd: {
    input: 'http://localhost:5000/swagger/v1/swagger.json',
    output: {
      mode: 'tags-split',
      target: 'src/api/generated/endpoints.ts',
      schemas: 'src/api/generated/model',
      client: 'swr',
      mock: false,
    },
  },
});
