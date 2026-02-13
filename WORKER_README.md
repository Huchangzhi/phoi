# PH Code API - Cloudflare Workers Deployment

This project provides a Cloudflare Worker implementation of the PH Code API, allowing online C++ compilation and execution through the Rextester API.

## Features

- Online C++ code compilation and execution
- Security checks to prevent dangerous code execution
- Support for standard input
- API-only mode (no UI included)

## Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) - Cloudflare's command-line tool
- A Cloudflare account

## Setup Instructions

1. Install Wrangler CLI globally:
   ```bash
   npm install -g wrangler
   ```

2. Log in to your Cloudflare account:
   ```bash
   wrangler login
   ```

3. Install project dependencies:
   ```bash
   npm install
   ```

4. Update the `wrangler.toml` file with your account details:
   - Replace `your-account-id` with your actual Cloudflare Account ID
   - Optionally configure routes and zones

## Configuration

Edit the `wrangler.toml` file to customize your deployment:

```toml
name = "phoi"  # Name of your worker
account_id = "your-account-id"  # Your Cloudflare Account ID
workers_dev = true  # Deploy to workers.dev subdomain
```

## Development

To test your worker locally:

```bash
npm run dev
```

This will start a local development server that simulates the Cloudflare Workers environment.

## Deployment

To deploy your worker to Cloudflare:

```bash
npm run deploy
```

Or alternatively:
```bash
wrangler deploy
```

## API Endpoints

### POST /run
Compile and execute C++ code via Rextester API.

Request body:
```json
{
  "code": "#include <iostream>\nint main() {\n    std::cout << \"Hello, World!\";\n    return 0;\n}",
  "input": ""
}
```

Response:
```json
{
  "Result": "Hello, World!\n",
  "Errors": null,
  "Stats": "compiled and executed in 0.12s"
}
```

### GET /easyrun_api
Execute code from URL parameter.

Query parameters:
- `url`: URL-encoded C++ code
- `stdin`: Optional standard input

Example:
```
/easyrun_api?url=%23include%20%3Ciostream%3E%0Aint%20main()%20%7B%0A%20%20%20%20std%3A%3Acout%20%3C%3C%20%22Hello%2C%20World!%22%3B%0A%20%20%20%20return%200%3B%0A%7D&stdin=
```

### GET /health
Health check endpoint.

Response:
```json
{
  "status": "OK",
  "message": "PH Code API is running"
}
```

## Using with Frontend

This Cloudflare Worker provides only the API backend. To use the complete PH Code editor:

1. Deploy the frontend separately (to GitHub Pages, Netlify, Vercel, etc.)
2. Update the frontend's API endpoint to point to your deployed worker
3. In the frontend's `script.js`, change the API calls from `/run` to your worker's URL

For example, if your worker is deployed at `https://phoi.your-subdomain.workers.dev`, update the frontend:
```javascript
// Change from:
const response = await fetch('/run', {...})

// To:
const response = await fetch('https://phoi.your-subdomain.workers.dev/run', {...})
```

## Security

The worker implements security checks to prevent execution of dangerous code patterns, including:
- System calls (`system`, `exec`, `fork`, etc.)
- File operations (`fopen`, `freopen`, etc.)
- Assembly code (`__asm__`)
- Platform-specific headers (`<windows.h>`, `<unistd.h>`)

## Troubleshooting

- If you encounter CORS issues during development, make sure your client is sending the correct headers
- Check the response headers to ensure proper CORS configuration
- For timeout errors, ensure the Rextester API is accessible and responsive

## License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.