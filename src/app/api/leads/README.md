# Lead Maintenance APIs

This directory contains APIs for automatic lead maintenance tasks:

1. Moving stale leads to "Give Up" status
2. Deleting old leads from "Give Up" and "Unqualified" statuses

## API Endpoints

### 1. Move Stale Leads to "Give Up"

**Endpoint:** `POST /api/leads/auto-update`

This API moves leads with statuses "New", "Assigned", "No Answer", "Follow Up", "Missed", and "RS" to "Give Up" status if they haven't been updated in the configured number of days (default: 14 days).

**Request Body:**
```json
{
  "api_key": "your-secret-api-key", // Optional for manual calls, required for cron jobs
  "reference_date": "2023-12-31T00:00:00Z", // Optional, defaults to current date
  "days_threshold": 14 // Optional, defaults to LEAD_GIVE_UP_DAYS_THRESHOLD env var or 14
}
```

**Response:**
```json
{
  "success": true,
  "message": "5 leads moved to Give Up status",
  "updated_leads": [
    {
      "id": 123,
      "phone_number": "+6588889999",
      "status": "give_up"
    }
  ]
}
```

### 2. Delete Old Leads

**Endpoint:** `POST /api/leads/auto-delete`

This API deletes leads with statuses "Give Up" or "Unqualified" if they have been in that status for the configured number of days (default: 90 days).

**Request Body:**
```json
{
  "api_key": "your-secret-api-key", // Optional for manual calls, required for cron jobs
  "reference_date": "2023-12-31T00:00:00Z", // Optional, defaults to current date
  "days_threshold": 90 // Optional, defaults to LEAD_DELETE_DAYS_THRESHOLD env var or 90
}
```

**Response:**
```json
{
  "success": true,
  "message": "3 leads deleted",
  "deleted_count": 3,
  "deleted_leads": [
    {
      "id": 456,
      "phone_number": "+6599998888",
      "status": "give_up"
    }
  ]
}
```

### 3. Combined Maintenance Cron Job

**Endpoint:** `POST /api/cron/lead-maintenance`

This API runs both maintenance tasks in sequence. It's designed to be called by a scheduler like GitHub Actions or Vercel Cron Jobs.

**Request Body:**
```json
{
  "api_key": "your-secret-api-key", // Required, must match LEAD_MAINTENANCE_API_KEY env var
  "reference_date": "2023-12-31T00:00:00Z", // Optional
  "update_days_threshold": 14, // Optional
  "delete_days_threshold": 90 // Optional
}
```

**Response:**
```json
{
  "success": true,
  "update_result": {
    "success": true,
    "message": "5 leads moved to Give Up status",
    "updated_leads": [...]
  },
  "delete_result": {
    "success": true,
    "message": "3 leads deleted",
    "deleted_count": 3,
    "deleted_leads": [...]
  }
}
```

## Environment Variables

Configure these environment variables to customize the behavior:

- `LEAD_GIVE_UP_DAYS_THRESHOLD`: Number of days of inactivity before moving leads to "Give Up" (default: 14)
- `LEAD_DELETE_DAYS_THRESHOLD`: Number of days before deleting "Give Up" and "Unqualified" leads (default: 90)
- `LEAD_MAINTENANCE_API_KEY`: Secret API key required for authentication (used by all APIs)
- `SYSTEM_USER_ID`: Optional ID to use for tracking system-initiated updates (defaults to "system")

## Authentication

These APIs support two authentication methods:

1. **API Key Authentication** - Recommended for cron jobs and automation
   - Pass an `api_key` in the request body
   - The key must match the `LEAD_MAINTENANCE_API_KEY` environment variable

2. **User Session Authentication** - For manual calls through the UI
   - Browser session will automatically authenticate the user
   - No additional parameters needed

## Setting Up Scheduled Execution

### Using GitHub Actions

1. Create a new GitHub Actions workflow:

```yaml
# .github/workflows/lead-maintenance.yml
name: Lead Maintenance

on:
  schedule:
    - cron: '0 0 * * *' # Run daily at midnight UTC

jobs:
  run-maintenance:
    runs-on: ubuntu-latest
    steps:
      - name: Run lead maintenance
        run: |
          curl -X POST https://your-domain.com/api/cron/lead-maintenance \
            -H "Content-Type: application/json" \
            -d '{"api_key": "${{ secrets.LEAD_MAINTENANCE_API_KEY }}"}'
```

### Using Vercel Cron Jobs

1. Create a new Vercel Cron Job from your project dashboard
2. Set the schedule (e.g., "0 0 * * *" for daily at midnight)
3. Set the endpoint to `/api/cron/lead-maintenance`
4. Configure the request body with your API key:
```json
{
  "api_key": "your-secret-api-key"
}
```

## Testing the APIs

You can test these APIs manually using tools like Postman or curl:

```bash
# Test auto-update API
curl -X POST https://your-domain.com/api/leads/auto-update \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your-secret-api-key"}'

# Test auto-delete API
curl -X POST https://your-domain.com/api/leads/auto-delete \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your-secret-api-key"}'

# Test cron job API
curl -X POST https://your-domain.com/api/cron/lead-maintenance \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your-secret-api-key"}'
``` 