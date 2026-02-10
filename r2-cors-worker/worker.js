// Cloudflare Worker to proxy R2 uploads with proper CORS headers

const ALLOWED_ORIGINS = [
  'https://www.studioz.co.il',
  'https://studioz.co.il',
  'http://localhost:5173',
  'https://api.studioz.co.il',
  'https://www.api.studioz.co.il',
];

function getCorsHeaders(request) {
  const origin = request.headers.get('Origin');
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, PUT, HEAD, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': 'ETag',
    'Access-Control-Max-Age': '3600',
  };
}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request);

    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Get the target R2 URL from the query parameter
    const url = new URL(request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
      return new Response('Missing url parameter', {
        status: 400,
        headers: corsHeaders,
      });
    }

    try {
      // For presigned URLs, make a clean request - the auth is in the URL
      const r2Response = await fetch(targetUrl, {
        method: request.method,
        body: request.method === 'PUT' || request.method === 'POST' ? request.body : undefined,
      });

      // Create response with CORS headers
      const responseHeaders = new Headers(r2Response.headers);
      Object.entries(corsHeaders).forEach(([key, value]) => {
        responseHeaders.set(key, value);
      });

      return new Response(r2Response.body, {
        status: r2Response.status,
        statusText: r2Response.statusText,
        headers: responseHeaders,
      });
    } catch (error) {
      return new Response(`Proxy error: ${error.message}`, {
        status: 500,
        headers: corsHeaders,
      });
    }
  },
};
