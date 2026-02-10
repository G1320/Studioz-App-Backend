// Cloudflare Worker with R2 binding for direct uploads

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

    const url = new URL(request.url);

    // Route: PUT /upload/:key - Upload file directly to R2
    if (request.method === 'PUT' && url.pathname.startsWith('/upload/')) {
      const key = decodeURIComponent(url.pathname.slice('/upload/'.length));

      if (!key) {
        return new Response('Missing key', {
          status: 400,
          headers: corsHeaders,
        });
      }

      try {
        // Upload directly to R2 using the binding
        const object = await env.R2_BUCKET.put(key, request.body, {
          httpMetadata: {
            contentType: request.headers.get('Content-Type') || 'application/octet-stream',
          },
        });

        return new Response(JSON.stringify({
          success: true,
          key: object.key,
          etag: object.etag,
        }), {
          status: 200,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'ETag': object.etag,
          },
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        });
      }
    }

    // Route: GET /download/:key - Download file from R2
    if (request.method === 'GET' && url.pathname.startsWith('/download/')) {
      const key = decodeURIComponent(url.pathname.slice('/download/'.length));

      try {
        const object = await env.R2_BUCKET.get(key);

        if (!object) {
          return new Response('Not found', {
            status: 404,
            headers: corsHeaders,
          });
        }

        const headers = new Headers(corsHeaders);
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);

        return new Response(object.body, { headers });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    return new Response('Not found', {
      status: 404,
      headers: corsHeaders,
    });
  },
};
