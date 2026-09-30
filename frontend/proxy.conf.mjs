// API_URL is set by docker-compose.dev.yml, where the API is not on localhost.
export default {
  '/api': {
    target: process.env.API_URL ?? 'http://localhost:8000',
    secure: false,
    pathRewrite: { '^/api': '' },
  },
};
