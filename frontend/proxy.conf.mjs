// API_URL is set by docker-compose.dev.yml, where the API is not on localhost.
const target = process.env.API_URL ?? 'http://localhost:8000';

export default {
  '/api': {
    target,
    secure: false,
    pathRewrite: { '^/api': '' },
  },
  // /api/docs asks for the schema at /openapi.json: in dev the API runs without
  // INVOICE_ROOT_PATH, so that its own :8000/docs works too.
  '/openapi.json': {
    target,
    secure: false,
  },
};
