// Cloudflare Worker for PH Code API
// Supports only API endpoints from the original Flask app

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
        
        // 404 for all other routes
        else {
            return createResponse({
                Errors: "Endpoint not found",
                Result: "",
                Stats: "The requested endpoint does not exist"
            }, 404);
        }
    }
};