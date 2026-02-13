// functions/run.js
import { Router } from 'itty-router';

// Create a new router
const router = Router();

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

// Define route for POST /run
export async function onRequestPost(context) {
    try {
        const { code, input } = await context.request.json();
        
        // Security check
        const securityCheck = checkSecurity(code || '');
        if (!securityCheck.safe) {
            return new Response(
                JSON.stringify({
                    Errors: securityCheck.message,
                    Result: "",
                    Stats: "Compilation aborted due to security violation."
                }),
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type',
                    },
                    status: 400
                }
            );
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
        
        return new Response(JSON.stringify(result), {
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
            }
        });

    } catch (error) {
        if (error.name === 'TimeoutError') {
            return new Response(
                JSON.stringify({
                    Errors: "Server Timeout: Request to compiler timed out, please try again later."
                }),
                {
                    headers: {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type',
                    },
                    status: 504
                }
            );
        }
        return new Response(
            JSON.stringify({
                Errors: `Internal Server Error: ${error.message}`
            }),
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'POST, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                },
                status: 500
            }
        );
    }
}