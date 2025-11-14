import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale } from './i18n/config';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Handle API proxy with runtime API_BASE configuration
  if (pathname.startsWith('/api/')) {
    try {
      const apiBase = process.env.API_BASE;

      if (apiBase) {
        // Construct backend URL
        const apiPath = pathname.substring('/api'.length); // Remove /api, keep /...
        const queryString = req.nextUrl.search; // Includes the '?' if present
        const targetUrl = `${apiBase}/api${apiPath}${queryString}`;

        console.log(
          `[API Proxy] ${req.method} ${pathname} → ${targetUrl}`
        );

        // Forward the request to backend
        const headers = new Headers(req.headers);
        headers.delete('host');
        headers.set('X-Forwarded-For', req.ip || 'unknown');
        headers.set('X-Forwarded-Proto', req.nextUrl.protocol.replace(':', ''));

        const init: RequestInit = {
          method: req.method,
          headers: headers,
        };

        // Include body for POST/PUT requests
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          init.body = req.body;
        }

        const response = await fetch(targetUrl, init);
        const responseHeaders = new Headers(response.headers);
        responseHeaders.set('X-Proxied-By', 'tessark-frontend');

        return new NextResponse(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        });
      }
    } catch (error) {
      console.error(
        `[API Proxy Error] ${error instanceof Error ? error.message : String(error)}`
      );
      // Fall back to rewrites if proxy fails
    }

    // If API_BASE not set or proxy failed, fall back to rewrites
    return NextResponse.next();
  }

  // Ignore Next internals and static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/assets')
  ) {
    return NextResponse.next();
  }

  // If path already starts with a valid locale, continue
  const segments = pathname.split('/').filter(Boolean);
  const maybeLocale = segments[0];
  if (maybeLocale && isLocale(maybeLocale)) {
    return NextResponse.next();
  }

  // Redirect to default locale keeping the rest of the path
  const url = req.nextUrl.clone();
  url.pathname = `/${defaultLocale}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next|.*\..*).*)'],
};

