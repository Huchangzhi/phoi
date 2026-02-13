@echo off
REM Script to deploy PH Code API to Cloudflare Workers

echo Installing dependencies...
npm install

echo Logging in to Cloudflare...
npx wrangler login

echo Deploying to Cloudflare Workers...
npx wrangler deploy

echo Deployment complete!
pause