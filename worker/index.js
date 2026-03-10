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

// Add COOP/COEP headers for clangd WASM (SharedArrayBuffer support)
function addSecurityHeaders(headers) {
    headers.set('Cross-Origin-Opener-Policy', 'same-origin');
    headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
    return headers;
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

        // 为所有请求添加 COOP/COEP 头（包括静态文件）
        // 不使用 ASSETS binding 的自动服务，而是手动处理
        async function handleRequest() {
            // Route: /run (POST) - Execute code via Rextester
            if (request.method === 'POST' && url.pathname === '/run') {
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
                            Errors: "No code provided"
                        }, 400);
                    }

                    const code = decodeURIComponent(urlEncodedCode);
                    const input = url.searchParams.get('input') || '';

                    // Security check
                    const securityCheck = checkSecurity(code);
                    if (!securityCheck.safe) {
                        return createResponse({
                            Errors: securityCheck.message,
                            Result: "",
                            Stats: "Compilation aborted due to security violation."
                        }, 400);
                    }

                    const payload = {
                        LanguageChoiceWrapper: LANG_CPP_GCC,
                        Program: code,
                        Input: input,
                        CompilerArgs: "-o a.out source_file.cpp -Wall -std=c++14 -O2 -pedantic-errors"
                    };

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
                    return createResponse({
                        Errors: `Internal Server Error: ${error.message}`
                    }, 500);
                }
            }

            // 所有其他请求 - 从 ASSETS 获取静态文件
            if (env.ASSETS) {
                try {
                    // 对于根路径，服务 index.html
                    let assetPath = url.pathname;
                    if (assetPath === '/') {
                        assetPath = '/index.html';
                    }

                    const assetResponse = await env.ASSETS.fetch(new Request(url.origin + assetPath));

                    if (assetResponse.status !== 404) {
                        const newHeaders = new Headers(assetResponse.headers);
                        addSecurityHeaders(newHeaders);
                        return new Response(assetResponse.body, {
                            headers: newHeaders,
                            status: assetResponse.status,
                            statusText: assetResponse.statusText
                        });
                    }
                } catch (e) {
                    console.error('Error fetching asset:', e);
                }
            }

            // Fallback: 404
            return new Response('Not Found', { status: 404 });
        }

        const response = await handleRequest();

        // 确保所有响应都有 COOP/COEP 头
        const newHeaders = new Headers(response.headers);
        addSecurityHeaders(newHeaders);

        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    }
};
