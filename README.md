# Crypto Monitor Service

Real-time cryptocurrency monitoring service that tracks price movements and volume spikes. Sends alerts to Telegram and stores them in Supabase.

## Features

- Real-time monitoring of crypto prices via Polygon.io WebSocket
- Detects volume spikes (relative volume ≥ 1.5x)
- Tracks new daily highs
- Sends alerts to Telegram
- Stores alerts in Supabase database

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

- `POLYGON_API_KEY`: Your Polygon.io API key
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key
- `TELEGRAM_BOT_TOKEN`: Your Telegram bot token
- `TELEGRAM_CHAT_ID`: Your Telegram chat ID for receiving alerts

## Development

```bash
npm install
npm run dev
```

## Deployment

This service is designed to be deployed on Railway. Connect your repository to Railway and it will automatically deploy when you push changes.

Make sure to set all environment variables in your Railway project settings.