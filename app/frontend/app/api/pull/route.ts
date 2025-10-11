import { NextRequest } from 'next/server';
import http from 'http';
import { URL } from 'url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const IMAGE_RE = /^[A-Za-z0-9./:@_\-]+$/; // allow letters, digits, slash, dot, colon, @, underscore, dash
const BACKEND_URL = process.env.BACKEND_URL || 'http://tessark-backend-service:8080';

export async function GET(req: NextRequest) {
  const ref = (req.nextUrl.searchParams.get('ref') || '').trim();
  const formatRaw = (req.nextUrl.searchParams.get('format') || 'docker-archive').trim();
  const format = formatRaw === 'oci-archive' ? 'oci-archive' : 'docker-archive';

  if (!ref) {
    return new Response('Paramètre "ref" manquant', { status: 400 });
  }
  if (!IMAGE_RE.test(ref)) {
    return new Response('Référence invalide', { status: 400 });
  }

  // Forward request to backend API using native HTTP for true streaming
  const backendUrl = `${BACKEND_URL}/api/pull?ref=${encodeURIComponent(ref)}&format=${encodeURIComponent(format)}`;

  return new Promise<Response>((resolve) => {
    const parsedUrl = new URL(backendUrl);

    const httpReq = http.request({
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'Accept': 'application/x-tar',
      },
      timeout: 5 * 60 * 1000, // 5 minutes
    }, (httpRes) => {
      if (httpRes.statusCode !== 200) {
        let errorBody = '';
        httpRes.on('data', (chunk) => { errorBody += chunk; });
        httpRes.on('end', () => {
          resolve(new Response(errorBody || 'Erreur backend', { status: httpRes.statusCode || 502 }));
        });
        return;
      }

      // Create a ReadableStream from the Node.js stream
      const stream = new ReadableStream({
        start(controller) {
          httpRes.on('data', (chunk) => {
            controller.enqueue(new Uint8Array(chunk));
          });
          httpRes.on('end', () => {
            controller.close();
          });
          httpRes.on('error', (err) => {
            controller.error(err);
          });
        },
        cancel() {
          httpRes.destroy();
        }
      });

      // Forward headers from backend
      const headers = new Headers();
      const contentType = httpRes.headers['content-type'];
      if (contentType) headers.set('content-type', contentType);

      const contentLength = httpRes.headers['content-length'];
      if (contentLength) headers.set('content-length', contentLength);

      const contentDisposition = httpRes.headers['content-disposition'];
      if (contentDisposition) headers.set('content-disposition', contentDisposition);

      headers.set('cache-control', 'no-store');

      resolve(new Response(stream, {
        status: 200,
        headers,
      }));
    });

    httpReq.on('error', (err) => {
      resolve(new Response(`Erreur lors de la communication avec le backend: ${err.message}`, { status: 502 }));
    });

    httpReq.on('timeout', () => {
      httpReq.destroy();
      resolve(new Response('Timeout lors de la copie de l\'image', { status: 504 }));
    });

    httpReq.end();
  });
}