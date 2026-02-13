// Cloudflare Worker for PH Code API
// Serves the original app with API endpoints

// Rextester API configuration
const REXTESTER_URL = "https://rextester.com/rundotnet/Run";
const LANG_CPP_GCC = 7;

// Security patterns to block
const DANGEROUS_PATTERNS = [
    /system\s*\(/,
    /exec[lqvpe]*\s*\(/,
    /fork\s*\(/,
    /popen\s*\(/,
    /kill\s*\(/,
    /<windows\.h>/,
    /<unistd\.h>/,
    /\bfstream\b/,
    /\bfreopen\b/,
    /\bFILE\s*\*/,
    /\bfopen\s*\(/,
    /__asm__/,
    /asm\s*\(/,
];

function checkSecurity(code) {
    for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(code)) {
            return { safe: false, message: `Security Alert: Detected forbidden pattern` };
        }
    }
    return { safe: true, message: "" };
}

// Helper function to create a response with CORS headers
function createResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        },
        status
    });
}

// Handle CORS preflight requests
function handleOptions(request) {
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            },
        });
    }
    return null;
}

// Main fetch handler
export default {
    async fetch(request, env, ctx) {
        // Handle CORS preflight
        const optionsResponse = handleOptions(request);
        if (optionsResponse) {
            return optionsResponse;
        }

        const url = new URL(request.url);

        // Route: / (GET) - Serve the main page
        if (request.method === 'GET' && url.pathname === '/') {
            // If we have ASSETS binding, try to serve index.html from there
            if (env.ASSETS) {
                const assetRequest = new Request(`${new URL(request.url).origin}/templates/index.html`, request);
                const assetResponse = await env.ASSETS.fetch(assetRequest);

                if (assetResponse.status !== 404) {
                    return new Response(assetResponse.body, {
                        headers: {
                            ...assetResponse.headers,
                            'Content-Type': 'text/html',
                        },
                        status: assetResponse.status
                    });
                }
            }

            // Fallback: return error if asset not found
            return new Response('Index page not found', { status: 404 });
        }

        // Route: /easyrun (GET) - Serve the easyrun page
        else if (request.method === 'GET' && url.pathname === '/easyrun') {
            // If we have ASSETS binding, try to serve easyrun.html from there
            if (env.ASSETS) {
                const assetRequest = new Request(`${new URL(request.url).origin}/templates/easyrun.html`, request);
                const assetResponse = await env.ASSETS.fetch(assetRequest);

                if (assetResponse.status !== 404) {
                    return new Response(assetResponse.body, {
                        headers: {
                            ...assetResponse.headers,
                            'Content-Type': 'text/html',
                        },
                        status: assetResponse.status
                    });
                }
            }

            // Fallback: return error if asset not found
            return new Response('EasyRun page not found', { status: 404 });
        }

        // Route: /run (POST) - Execute code via Rextester
        else if (request.method === 'POST' && url.pathname === '/run') {
            try {
                const { code, input } = await request.json();

                // Security check
                const securityCheck = checkSecurity(code || '');
                if (!securityCheck.safe) {
                    return createResponse({
                        Errors: securityCheck.message,
                        Result: "",
                        Stats: "Compilation aborted due to security violation."
                    }, 400);
                }

                // Prepare payload for Rextester
                const payload = {
                    LanguageChoiceWrapper: LANG_CPP_GCC,
                    Program: code || '',
                    Input: input || '',
                    CompilerArgs: "-o a.out source_file.cpp -Wall -std=c++14 -O2"
                };

                // Send request to Rextester
                const resp = await fetch(REXTESTER_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(payload)
                });

                if (!resp.ok) {
                    throw new Error(`Rextester API error: ${resp.status}`);
                }

                const result = await resp.json();
                return createResponse(result);

            } catch (error) {
                if (error.name === 'TimeoutError') {
                    return createResponse({
                        Errors: "Server Timeout: Request to compiler timed out, please try again later."
                    }, 504);
                }
                return createResponse({
                    Errors: `Internal Server Error: ${error.message}`
                }, 500);
            }
        }

        // Route: /easyrun_api (GET) - Execute code from URL parameter
        else if (request.method === 'GET' && url.pathname === '/easyrun_api') {
            try {
                const urlEncodedCode = url.searchParams.get('url');
                if (!urlEncodedCode) {
                    return createResponse({
                        Errors: "Missing code in URL parameter"
                    }, 400);
                }

                // Decode the URL-encoded code
                const code = decodeURIComponent(urlEncodedCode);

                // Security check
                const securityCheck = checkSecurity(code);
                if (!securityCheck.safe) {
                    return createResponse({
                        Errors: securityCheck.message,
                        Result: "",
                        Stats: "Compilation aborted due to security violation."
                    }, 400);
                }

                // Get optional stdin
                const stdin = url.searchParams.get('stdin') || '';

                // Prepare payload for Rextester
                const payload = {
                    LanguageChoiceWrapper: LANG_CPP_GCC,
                    Program: code,
                    Input: stdin,
                    CompilerArgs: "-o a.out source_file.cpp -Wall -std=c++14 -O2"
                };

                // Send request to Rextester
                const resp = await fetch(REXTESTER_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                    },
                    body: new URLSearchParams(payload)
                });

                if (!resp.ok) {
                    throw new Error(`Rextester API error: ${resp.status}`);
                }

                const result = await resp.json();
                return createResponse(result);

            } catch (error) {
                if (error.name === 'TimeoutError') {
                    return createResponse({
                        Errors: "Server Timeout: Request to compiler timed out, please try again later."
                    }, 504);
                }
                return createResponse({
                    Errors: `Internal Server Error: ${error.message}`
                }, 500);
            }
        }

        // Route: /health (GET) - Health check endpoint
        else if (request.method === 'GET' && url.pathname === '/health') {
            return createResponse({ status: 'OK', message: 'PH Code API is running' });
        }

        // For all other routes, let the static assets system handle it
        else {
            // If we have ASSETS binding, try to serve static assets directly from there
            if (env.ASSETS) {
                // Adjust the path to look for static files in the correct location
                let adjustedRequest = request;
                if (url.pathname.startsWith('/static/')) {
                    // For /static/* requests, look in the static directory
                    adjustedRequest = new Request(url.toString().replace('/static/', '/static/'), request);
                }
                
                const assetResponse = await env.ASSETS.fetch(adjustedRequest);

                // If asset was found, return it
                if (assetResponse.status !== 404) {
                    return assetResponse;
                }
            }

            // For API routes that don't match, return 404
            if (url.pathname.startsWith('/api/') || url.pathname === '/run' || url.pathname === '/easyrun_api' || url.pathname === '/health') {
                return createResponse({
                    Errors: "Endpoint not found",
                    Result: "",
                    Stats: "The requested endpoint does not exist"
                }, 404);
            }

            // For routes that look like static assets, try to serve from the static directory
            if (url.pathname.startsWith('/static/')) {
                // Try looking for the file in the static directory
                if (env.ASSETS) {
                    // Since assets are stored in /static/ under dist, we can directly fetch
                    const assetResponse = await env.ASSETS.fetch(request);

                    if (assetResponse.status !== 404) {
                        return assetResponse;
                    }
                }
                return new Response('Not Found', { status: 404 });
            }

            // For other routes, serve the main index page (SPA fallback)
            if (env.ASSETS) {
                const assetRequest = new Request(`${new URL(request.url).origin}/templates/index.html`, request);
                const assetResponse = await env.ASSETS.fetch(assetRequest);

                if (assetResponse.status !== 404) {
                    return new Response(assetResponse.body, {
                        headers: {
                            ...assetResponse.headers,
                            'Content-Type': 'text/html',
                        },
                        status: assetResponse.status
                    });
                }
            }

            // Fallback: return error if asset not found
            return new Response('Page not found', { status: 404 });
        }
    }
};