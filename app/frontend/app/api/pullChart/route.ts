import { NextRequest } from 'next/server';
import http from 'http';
import { URL } from 'url';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CHART_REF_RE = /^[A-Za-z0-9./:@_\-]+$/; // allow letters, digits, slash, dot, colon, @, underscore, dash
const BACKEND_URL = process.env.BACKEND_URL || 'http://tessark-backend-service:8080';

// Log backend URL on first import
if (process.env.NODE_ENV === 'development') {
  console.log('[API/pullChart] Backend URL configured as:', BACKEND_URL);
}

interface PullChartRequest {
  ref: string;
  version?: string;
  username?: string;
  password?: string;
}

export async function POST(req: NextRequest) {
  let body: PullChartRequest;
  try {
    body = await req.json();
  } catch (e) {
    console.error('Failed to parse JSON body:', e);
    return new Response('Invalid JSON body', { status: 400 });
  }

  const ref = (body.ref || '').trim();
  const version = (body.version || '').trim();
  const username = (body.username || '').trim();
  const password = (body.password || '').trim();

  console.log('POST /api/pullChart received:', { ref, version, hasUsername: !!username, hasPassword: !!password });

  if (!ref) {
    return new Response('Missing chart reference', { status: 400 });
  }
  if (!CHART_REF_RE.test(ref)) {
    return new Response('Invalid chart reference format', { status: 400 });
  }

  // Build request body for backend
  const backendRequestBody: PullChartRequest = {
    ref,
  };

  if (version) {
    backendRequestBody.version = version;
  }
  if (username && password) {
    backendRequestBody.username = username;
    backendRequestBody.password = password;
  }

  const backendUrl = `${BACKEND_URL}/api/pullChart`;

  console.log('Proxying to backend:', { backendUrl, method: 'POST' });

  return new Promise<Response>((resolve) => {
    const parsedUrl = new URL(backendUrl);
    const bodyString = JSON.stringify(backendRequestBody);

    const httpReq = http.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 80,
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(bodyString),
        },
        timeout: 5 * 60 * 1000, // 5 minutes
      },
      (httpRes) => {
        console.log('Backend response:', { statusCode: httpRes.statusCode });
        if (httpRes.statusCode !== 200) {
          let errorBody = '';
          httpRes.on('data', (chunk) => {
            errorBody += chunk;
          });
          httpRes.on('end', () => {
            const errorMsg = errorBody || `Backend returned ${httpRes.statusCode}`;
            console.error('Backend error:', { statusCode: httpRes.statusCode, body: errorMsg });
            resolve(
              new Response(errorMsg, {
                status: httpRes.statusCode || 502,
              })
            );
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
          },
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

        resolve(
          new Response(stream, {
            status: 200,
            headers,
          })
        );
      }
    );

    httpReq.on('error', (err) => {
      console.error('Backend connection error:', { message: err.message, code: (err as any).code });
      resolve(
        new Response(`Backend connection error: ${err.message}`, {
          status: 502,
        })
      );
    });

    httpReq.on('timeout', () => {
      console.error('Backend request timeout');
      httpReq.destroy();
      resolve(new Response('Backend request timeout (exceeded 5 minutes)', { status: 504 }));
    });

    console.log('Sending request body to backend...');
    httpReq.write(bodyString);
    httpReq.end();
  });
}
