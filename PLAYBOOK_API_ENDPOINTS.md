# Playbook Management API Endpoints

This document lists all the available API endpoints for managing playbooks in the T3 Gallery application.

## Base URL
All endpoints are relative to your application's base URL (e.g., `https://your-domain.com`)

## Authentication
All endpoints require proper authentication (handled by your existing auth middleware).

---

## 1. Get All Playbooks
**GET** `/api/playbooks`

Returns all playbooks with their current status, contact counts, and Samespace running status.

**Response:**
```json
{
  "success": true,
  "message": "Found X playbooks",
  "data": [
    {
      "id": 1,
      "samespace_playbook_id": "abc123",
      "name": "Agent John's Playbook",
      "agent_id": "user_xyz",
      "agent_name": "John",
      "is_active": true,
      "contact_count": 25,
      "samespace_status": "active",
      "is_running": false,
      "last_synced_at": "2024-01-15T10:30:00Z",
      "created_at": "2024-01-10T09:00:00Z"
    }
  ]
}
```

---

## 2. Register New Playbook
**POST** `/api/playbooks`

Register an existing Samespace playbook with your system.

**Request Body:**
```json
{
  "samespacePlaybookId": "abc123",
  "name": "My Playbook Name",
  "agentId": "user_xyz"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Playbook registered successfully",
  "data": {
    "id": 1,
    "samespace_playbook_id": "abc123",
    "name": "My Playbook Name",
    "agent_id": "user_xyz",
    "is_active": true
  }
}
```

---

## 3. Start Playbook
**POST** `/api/playbooks/{id}/start`

Start a specific playbook in Samespace.

**URL Parameters:**
- `id` (number): The playbook ID from your database

**Response:**
```json
{
  "success": true,
  "message": "Playbook started successfully",
  "data": {
    "success": true
  }
}
```

---

## 4. Stop Playbook
**POST** `/api/playbooks/{id}/stop`

Stop a specific playbook in Samespace.

**URL Parameters:**
- `id` (number): The playbook ID from your database

**Response:**
```json
{
  "success": true,
  "message": "Playbook stopped successfully",
  "data": {
    "success": true
  }
}
```

---

## 5. Sync Playbook Contacts
**POST** `/api/playbooks/{id}/sync`

Sync new contacts for a specific playbook (adds new assigned leads to the playbook).

**URL Parameters:**
- `id` (number): The playbook ID from your database

**Response:**
```json
{
  "success": true,
  "message": "Sync completed: 5 created, 0 failed, playbook updated",
  "data": {
    "contactsCreated": 5,
    "contactsFailed": 0,
    "playbookUpdated": true,
    "details": [
      {
        "leadId": 123,
        "leadName": "John Doe",
        "phone": "+6591234567",
        "status": "created"
      }
    ]
  }
}
```

---

## 6. Delete Playbook
**DELETE** `/api/playbooks`

Delete a playbook (stops it, removes contacts, and marks as inactive).

**Request Body:**
```json
{
  "playbookId": 1
}
```

**Response:**
```json
{
  "success": true,
  "message": "Playbook deleted successfully",
  "data": {
    "playbookId": 1
  }
}
```

---

## 7. Cron Sync All Playbooks (⭐ Main Cron Job)
**POST** `/api/playbooks/cron-sync`

**This is the main endpoint for your cron job!** 

Performs the complete sync cycle:
1. Start all inactive playbooks
2. Sync contacts for all playbooks  
3. Stop all playbooks

**Response:**
```json
{
  "success": true,
  "message": "Cron sync completed: 3 synced, 2 started, 3 stopped",
  "data": {
    "synced": 3,
    "started": 2,
    "stopped": 3,
    "details": [
      {
        "playbook_id": 1,
        "name": "Agent John's Playbook",
        "started": true,
        "synced": true,
        "stopped": true,
        "sync_details": {
          "contactsCreated": 5,
          "contactsFailed": 0
        }
      }
    ]
  }
}
```

---

## 8. Stop All Playbooks
**POST** `/api/playbooks/stop-all`

Stop all currently running playbooks and cleanup their contacts.

**Response:**
```json
{
  "success": true,
  "message": "Stop all completed: 3 stopped, 0 failed, 25 contacts cleaned",
  "data": {
    "stopped": 3,
    "failed": 0,
    "contacts_cleaned": 25,
    "details": [
      {
        "playbook_id": 1,
        "name": "Agent John's Playbook",
        "stopped": true,
        "stop_message": "Playbook stopped successfully",
        "contacts_cleaned": 8,
        "cleanup_success": true,
        "cleanup_message": "Cleanup completed: 8 contacts deleted from Samespace"
      }
    ]
  }
}
```

---

## Cron Job Setup

### For every 15 minutes sync:
```bash
# Add this to your crontab or use a service like Vercel Cron, GitHub Actions, etc.
*/15 * * * * curl -X POST https://your-domain.com/api/playbooks/cron-sync
```

### Using GitHub Actions (recommended):
Create `.github/workflows/playbook-sync.yml`:
```yaml
name: Playbook Sync
on:
  schedule:
    - cron: '*/15 * * * *'  # Every 15 minutes
  workflow_dispatch: # Allow manual trigger

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Sync Playbooks
        run: |
          curl -X POST https://your-domain.com/api/playbooks/cron-sync
```

### Using Vercel Cron:
Create `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/playbooks/cron-sync",
      "schedule": "*/15 * * * *"
    }
  ]
}
```

---

## Error Responses

All endpoints return error responses in this format:
```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

Common HTTP status codes:
- `200`: Success
- `400`: Bad request (validation error)
- `404`: Playbook not found
- `500`: Server error

---

## Usage Examples

### Testing with curl:

```bash
# Get all playbooks
curl -X GET https://your-domain.com/api/playbooks

# Start playbook ID 1
curl -X POST https://your-domain.com/api/playbooks/1/start

# Stop playbook ID 1  
curl -X POST https://your-domain.com/api/playbooks/1/stop

# Sync playbook ID 1
curl -X POST https://your-domain.com/api/playbooks/1/sync

# Run cron sync (main endpoint)
curl -X POST https://your-domain.com/api/playbooks/cron-sync

# Stop all playbooks
curl -X POST https://your-domain.com/api/playbooks/stop-all
```

### JavaScript/TypeScript usage:

```typescript
// Cron sync (main function)
const response = await fetch('/api/playbooks/cron-sync', {
  method: 'POST',
});
const result = await response.json();
console.log(result);

// Start specific playbook
const startResponse = await fetch(`/api/playbooks/${playbookId}/start`, {
  method: 'POST',
});
const startResult = await startResponse.json();
``` 