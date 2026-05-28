import type { IncomingMessage, ServerResponse } from 'http';
import { createApp } from '../server';

let appPromise: ReturnType<typeof createApp> | null = null;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  appPromise ??= createApp();
  const app = await appPromise;

  if (req.url && !req.url.startsWith('/api') && req.url !== '/auth/callback') {
    req.url = `/api${req.url}`;
  }

  return app(req, res);
}
