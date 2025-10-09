# Timeslot Generation System

This system automatically generates appointment timeslots based on calendar settings. It includes two API endpoints:

1. `/api/timeslots/generate` - Creates timeslots for a specified number of days ahead
2. `/api/cron/generate-timeslots` - A secure wrapper for the above endpoint, designed to be called by a cron job

## Environment Variables

Add these environment variables to your `.env` file:

```
# API keys for secure access
TIMESLOT_GENERATION_API_KEY=your_secure_api_key_here
CRON_API_KEY=your_secure_cron_key_here

# Base URL for internal API calls
NEXT_PUBLIC_BASE_URL=https://your-app-domain.com
```

## API Documentation

### Generate Timeslots

Endpoint: `POST /api/timeslots/generate`

This API generates timeslots based on calendar settings in the database.

**Request Body:**
```json
{
  "days_ahead": 30,
  "calendar_setting_id": 1, // Optional, if not provided all settings will be used
  "api_key": "your_secure_api_key_here"
}
```

**Response:**
```json
{
  "success": true,
  "created_count": 120,
  "timeslots": [
    {
      "date": "2023-06-01",
      "start_time": "09:00",
      "end_time": "09:30",
      "calendar_setting_id": 1
    },
    // ...more timeslots
  ],
  "errors": [] // Any errors encountered during generation
}
```

### Cron Job Endpoint

Endpoint: `POST /api/cron/generate-timeslots`

This endpoint is designed to be called by a cron job service to trigger daily timeslot generation.

**Request Body:**
```json
{
  "api_key": "your_secure_cron_key_here"
}
```

**Response:**
Same as the generate endpoint, with additional timestamp and cron execution flag:
```json
{
  "success": true,
  "created_count": 120,
  "timeslots": [...],
  "errors": [],
  "timestamp": "2023-06-01T09:00:00.000Z",
  "cron_execution": true
}
```

## Setting Up a Cron Job

### Using GitHub Actions

Add this workflow file to your repository at `.github/workflows/generate-timeslots.yml`:

```yaml
name: Generate Timeslots

on:
  schedule:
    # Run at 00:01 UTC every day
    - cron: '1 0 * * *'
  workflow_dispatch: # Allow manual triggering

jobs:
  generate-timeslots:
    runs-on: ubuntu-latest
    steps:
      - name: Call Timeslot Generation API
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/cron/generate-timeslots \
            -H "Content-Type: application/json" \
            -d '{"api_key":"${{ secrets.CRON_API_KEY }}"}'
```

Add these secrets to your GitHub repository:
- `APP_URL`: Your application URL (e.g., https://your-app-domain.com)
- `CRON_API_KEY`: The secure API key for cron jobs (same as in your .env file)

### Using an External Cron Service

You can also use services like:
- [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs)
- [GitHub Actions](https://docs.github.com/en/actions/using-workflows/events-that-trigger-workflows#schedule)
- [EasyCron](https://www.easycron.com/)
- [Cron-job.org](https://cron-job.org/)

Configure the service to make a POST request to your endpoint with the required API key:

```
URL: https://your-app-domain.com/api/cron/generate-timeslots
Method: POST
Headers: Content-Type: application/json
Body: {"api_key":"your_secure_cron_key_here"}
```

## How Timeslots Are Generated

The system:

1. Gets calendar settings from the database
2. Checks for existing timeslots to avoid duplicates
3. Uses calendar exceptions to skip days marked as closed (e.g., holidays)
4. Generates timeslots according to:
   - Working days configuration (Mon-Fri by default)
   - Business hours (start and end times)
   - Slot duration (30 minutes by default)
   - Maximum capacity per slot

By running this as a daily cron job, you'll always have timeslots available for the next 30 days (or whatever period you configure). 