import type { IncomingMessage, ServerResponse } from 'http';
import { createApiApp } from '../apiApp';

const app = createApiApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.url && !req.url.startsWith('/api') && req.url !== '/auth/callback') {
    req.url = `/api${req.url}`;
  }

  return app(req, res);
}
