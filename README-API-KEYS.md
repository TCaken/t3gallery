# API Key Management

This document explains the API key management approach used in this application.

## Single API Key System

All protected API routes in this application now use a single environment variable called `API_KEY`. This simplifies API key management and ensures consistent authentication across all endpoints.

## Protected Routes

The following API routes are protected by the `API_KEY`:

1. **Timeslot Management**
   - `/api/timeslots/generate` - For generating timeslots
   - `/api/cron/generate-timeslots` - Cron job wrapper for generating timeslots

2. **Lead Management**
   - `/api/leads/auto-update` - For moving stale leads to "Give Up" status
   - `/api/leads/auto-delete` - For deleting old leads
   - `/api/cron/lead-maintenance` - Cron job wrapper for lead maintenance

## Configuration

To set up the API key:

1. Add the `API_KEY` environment variable to your `.env` file:
   ```
   API_KEY=your_secure_api_key_here
   ```

2. For production environments, set the `API_KEY` in your hosting platform's environment variables.

## Making API Requests

When making requests to protected routes, include the API key in the request body:

```json
{
  "api_key": "your_secure_api_key_here",
  // other parameters...
}
```

## Security Best Practices

- Use a strong, randomly generated API key
- Rotate your API key regularly
- Never commit your API key to version control
- Only share the API key with authorized services and personnel
- Use HTTPS for all API requests to ensure the API key is transmitted securely

## Migration Notes

This application previously used multiple API keys:
- `TIMESLOT_GENERATION_API_KEY` for timeslot-related endpoints
- `LEAD_MAINTENANCE_API_KEY` for lead-related endpoints

All endpoints have been updated to use the unified `API_KEY` environment variable. 