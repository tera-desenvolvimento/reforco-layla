import express from 'express';
import { google } from 'googleapis';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';

dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const APP_URL = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const isSecureAppUrl = APP_URL.startsWith('https://');
const authCookieOptions = {
  httpOnly: true,
  secure: isSecureAppUrl,
  sameSite: isSecureAppUrl ? 'none' as const : 'lax' as const,
};

const getGoogleApiErrorResponse = (error: any) => {
  const status = error?.code || error?.response?.status || 500;
  const message = error?.errors?.[0]?.message || error?.message || 'Erro inesperado no Google.';

  if (status === 401) {
    return {
      status,
      error: 'Sessão do Google expirada. Saia e conecte novamente.',
    };
  }

  if (status === 403) {
    if (message.includes('Google Sheets API has not been used') || message.includes('disabled')) {
      return {
        status,
        error: 'A Google Sheets API está desativada no projeto Google Cloud deste OAuth. Ative a API e tente novamente em alguns minutos.',
      };
    }

    return {
      status,
      error: 'Essa conta Google não tem permissão para acessar essa planilha ou não foi liberada para usar este app OAuth.',
    };
  }

  return {
    status,
    error: message,
  };
};

export function createApiApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  const getOAuthClient = () => new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    `${APP_URL}/auth/callback`
  );

  app.get('/api/auth/google/url', (req, res) => {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      return res.status(500).json({ error: 'Configuração do Google OAuth ausente.' });
    }

    const client = getOAuthClient();
    const url = client.generateAuthUrl({
      access_type: 'offline',
      scope: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.metadata.readonly',
      ],
      prompt: 'consent select_account',
    });

    res.json({ url });
  });

  app.post('/api/update-ranking-score', async (req, res) => {
    try {
      const { spreadsheetId, range, value } = req.body;
      const tokensStr = req.cookies.google_tokens;
      if (!tokensStr) {
        return res.json({ success: false, error: 'Sessão expirada. Por favor, conecte-se novamente.' });
      }

      if (!spreadsheetId || !range || value === undefined) {
        return res.json({ success: false, error: 'Dados incompletos para atualização.' });
      }

      const tokens = JSON.parse(tokensStr);
      const client = getOAuthClient();
      client.setCredentials(tokens);

      const sheets = google.sheets({ version: 'v4', auth: client });

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[value]],
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      const message = error.errors?.[0]?.message || error.message || 'Erro inesperado na planilha.';
      const isAuthError = error.code === 401 || error.code === 403 || message.includes('auth') || message.includes('permission');

      res.json({
        success: false,
        error: isAuthError ? 'Ação negada: Você precisa reconectar sua conta com permissão de escrita.' : message,
        isAuthError,
      });
    }
  });

  app.get(['/auth/callback', '/auth/callback/', '/api/auth/callback', '/api/auth/callback/'], async (req, res) => {
    const { code } = req.query;

    if (!code) {
      return res.status(400).send('Código de autorização ausente.');
    }

    try {
      const client = getOAuthClient();
      const { tokens } = await client.getToken(code as string);

      res.cookie('google_tokens', JSON.stringify(tokens), {
        ...authCookieOptions,
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      res.send(`
        <html>
          <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f4f4f9;">
            <div style="text-align: center; padding: 20px; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
              <h2>Autenticado com sucesso!</h2>
              <p>Esta janela fechará automaticamente...</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                  setTimeout(() => window.close(), 1000);
                } else {
                  window.location.href = '/';
                }
              </script>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Erro ao trocar código por tokens:', error);
      res.status(500).send('Erro na autenticação.');
    }
  });

  app.get('/api/sheets/list', async (req, res) => {
    const tokensStr = req.cookies.google_tokens;
    if (!tokensStr) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    try {
      const tokens = JSON.parse(tokensStr);
      const client = getOAuthClient();
      client.setCredentials(tokens);

      const drive = google.drive({ version: 'v3', auth: client });
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        pageSize: 10,
        fields: 'files(id, name, modifiedTime)',
      });

      res.json({ sheets: response.data.files });
    } catch (error: any) {
      const apiError = getGoogleApiErrorResponse(error);
      res.status(apiError.status).json({ error: apiError.error });
    }
  });

  app.get('/api/sheets/:id', async (req, res) => {
    const tokensStr = req.cookies.google_tokens;
    if (!tokensStr) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    try {
      const tokens = JSON.parse(tokensStr);
      const client = getOAuthClient();
      client.setCredentials(tokens);

      const sheets = google.sheets({ version: 'v4', auth: client });
      const spreadsheetId = req.params.id;
      const requestedSheetName = req.query.sheetName as string;

      const metadata = await sheets.spreadsheets.get({ spreadsheetId });
      const allSheetNames = metadata.data.sheets?.map(s => s.properties?.title || '').filter(Boolean) || [];
      let sheetToFetch = requestedSheetName;
      if (!sheetToFetch || !allSheetNames.includes(sheetToFetch)) {
        sheetToFetch = allSheetNames[0];
      }

      const data = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetToFetch}!A1:Z500`,
      });

      res.json({
        title: metadata.data.properties?.title,
        sheetName: sheetToFetch,
        allSheetNames,
        values: data.data.values || [],
      });
    } catch (error: any) {
      const apiError = getGoogleApiErrorResponse(error);
      res.status(apiError.status).json({ error: apiError.error });
    }
  });

  app.get('/api/spreadsheets/:id/all-data', async (req, res) => {
    const tokensStr = req.cookies.google_tokens;
    if (!tokensStr) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    try {
      const tokens = JSON.parse(tokensStr);
      const client = getOAuthClient();
      client.setCredentials(tokens);

      const sheets = google.sheets({ version: 'v4', auth: client });
      const spreadsheetId = req.params.id;
      const metadata = await sheets.spreadsheets.get({ spreadsheetId });
      const sheetNames = metadata.data.sheets?.map(s => s.properties?.title || '').filter(Boolean) || [];

      const allData = await Promise.all(sheetNames.map(async (name) => {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${name}!A1:Z500`,
        });
        return {
          name,
          values: response.data.values || [],
        };
      }));

      res.json({
        title: metadata.data.properties?.title,
        sheets: allData,
      });
    } catch (error: any) {
      const apiError = getGoogleApiErrorResponse(error);
      res.status(apiError.status).json({ error: apiError.error });
    }
  });

  app.put('/api/spreadsheets/:id/values', async (req, res) => {
    const tokensStr = req.cookies.google_tokens;
    if (!tokensStr) {
      return res.status(401).json({ error: 'Não autenticado.' });
    }

    const { sheetName, row, col, value } = req.body;
    if (!sheetName || row === undefined || col === undefined) {
      return res.status(400).json({ error: 'Parâmetros inválidos.' });
    }

    try {
      const tokens = JSON.parse(tokensStr);
      const client = getOAuthClient();
      client.setCredentials(tokens);

      const sheets = google.sheets({ version: 'v4', auth: client });
      const spreadsheetId = req.params.id;
      const colLetter = String.fromCharCode(65 + col);
      const range = `${sheetName}!${colLetter}${row + 1}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [[value]],
        },
      });

      res.json({ success: true });
    } catch (error: any) {
      const apiError = getGoogleApiErrorResponse(error);
      res.status(apiError.status).json({ error: apiError.error });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('google_tokens', {
      ...authCookieOptions,
    });
    res.json({ success: true });
  });

  return app;
}
