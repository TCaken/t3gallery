# Auto-Assignment API Documentation

## Overview
These APIs allow external systems to control auto-assignment settings without requiring user authentication. Instead, they use a secure API key stored in environment variables.

## Authentication
All endpoints require an API key for authentication:
- Environment variable: `AUTO_ASSIGNMENT_API_KEY`
- Can be passed as:
  - Request body parameter: `api_key`
  - Query parameter: `api_key` (for GET requests)

## Endpoints

### 1. Start Auto-Assignment
**POST** `/api/auto-assignment/start`

Enable auto-assignment for new leads.

**Request:**
```json
{
  "api_key": "your_secure_api_key"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Auto-assignment enabled successfully",
  "settings": {
    "id": 1,
    "is_enabled": true,
    "assignment_method": "round_robin",
    "current_round_robin_index": 0,
    "max_leads_per_agent_per_day": 20,
    "updated_at": "2024-01-15T10:30:00Z",
    "updated_by": "api"
  }
}
```

### 2. Stop Auto-Assignment
**POST** `/api/auto-assignment/stop`

Disable auto-assignment for new leads.

**Request:**
```json
{
  "api_key": "your_secure_api_key"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Auto-assignment disabled successfully",
  "settings": {
    "id": 1,
    "is_enabled": false,
    "assignment_method": "round_robin",
    "current_round_robin_index": 0,
    "max_leads_per_agent_per_day": 20,
    "updated_at": "2024-01-15T10:35:00Z",
    "updated_by": "api"
  }
}
```

### 3. Check Auto-Assignment Status
**GET** `/api/auto-assignment/status?api_key=your_secure_api_key`
**POST** `/api/auto-assignment/status`

Get current auto-assignment settings.

**GET Request:**
```
GET /api/auto-assignment/status?api_key=your_secure_api_key
```

**POST Request:**
```json
{
  "api_key": "your_secure_api_key"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Auto-assignment status retrieved successfully",
  "settings": {
    "id": 1,
    "is_enabled": true,
    "assignment_method": "round_robin",
    "current_round_robin_index": 3,
    "last_assigned_agent_id": "agent_123",
    "max_leads_per_agent_per_day": 20,
    "created_at": "2024-01-15T08:00:00Z",
    "updated_at": "2024-01-15T10:30:00Z",
    "updated_by": "api"
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "success": false,
  "message": "Invalid request format",
  "errors": [
    {
      "code": "invalid_type",
      "expected": "string",
      "received": "undefined",
      "path": ["api_key"],
      "message": "Required"
    }
  ]
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "message": "Invalid API key"
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "message": "Error enabling auto-assignment: Database connection failed"
}
```

## Usage Examples

### Enable Auto-Assignment
```bash
curl -X POST https://your-domain.com/api/auto-assignment/start \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your_secure_api_key"}'
```

### Disable Auto-Assignment
```bash
curl -X POST https://your-domain.com/api/auto-assignment/stop \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your_secure_api_key"}'
```

### Check Status (GET)
```bash
curl "https://your-domain.com/api/auto-assignment/status?api_key=your_secure_api_key"
```

### Check Status (POST)
```bash
curl -X POST https://your-domain.com/api/auto-assignment/status \
  -H "Content-Type: application/json" \
  -d '{"api_key": "your_secure_api_key"}'
```

## Integration with External Systems

### GitHub Actions Example
```yaml
name: Enable Auto-Assignment
on:
  schedule:
    - cron: '0 9 * * 1-5'  # 9 AM on weekdays

jobs:
  enable-auto-assignment:
    runs-on: ubuntu-latest
    steps:
      - name: Enable Auto-Assignment
        run: |
          curl -X POST ${{ secrets.APP_URL }}/api/auto-assignment/start \
            -H "Content-Type: application/json" \
            -d '{"api_key": "${{ secrets.AUTO_ASSIGNMENT_API_KEY }}"}'
```

### Vercel Cron Job Example
```javascript
// api/cron/enable-auto-assignment.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    const response = await fetch(`${process.env.APP_URL}/api/auto-assignment/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: process.env.AUTO_ASSIGNMENT_API_KEY,
      }),
    });

    const result = await response.json();
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to enable auto-assignment' });
  }
}
```

## Security Notes

1. **Environment Variable**: The API key must be stored in `AUTO_ASSIGNMENT_API_KEY` environment variable
2. **Key Rotation**: Regularly rotate the API key for security
3. **HTTPS Only**: Always use HTTPS in production
4. **Rate Limiting**: Consider implementing rate limiting for production use
5. **Logging**: All API calls are logged with timestamps and actions

## Environment Setup

### Setting the API Key
The API key should be a strong, randomly generated string. See the next section for how to generate one securely. 