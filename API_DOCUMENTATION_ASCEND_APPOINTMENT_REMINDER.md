# Ascend Appointment Reminder API Documentation

## Overview

The Ascend Appointment Reminder API allows you to send WhatsApp appointment reminders using a predefined template. This API requires authentication via API key and logs all requests for tracking and debugging purposes.

## Base Information

- **Endpoint**: `/api/appointments/ascend`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Authentication**: API Key (required)

## Authentication

### API Key Requirements

All requests must include a valid API key in the request headers.

**Supported Header Names:**
- `x-api-key` (preferred)
- `apikey` (alternative)

**Example:**
```bash
x-api-key: your-secure-api-key-here
```

## Request Format

### Headers

```http
POST /api/appointments/ascend HTTP/1.1
Content-Type: application/json
x-api-key: your-secure-api-key-here
```

### Request Body

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `customerName` | string | ✅ | Customer's full name | `"John Doe"` |
| `phoneNumber` | string | ✅ | Customer's phone number (international format preferred) | `"+6583992504"` |
| `appointmentDate` | string | ✅ | Appointment date in YYYY-MM-DD format | `"2025-01-15"` |
| `timeSlot` | string | ✅ | Time slot description | `"2:00 PM"`, `"Morning"`, `"Noon"` |
| `app` | string | ❌ | Source application identifier | `"dashboard"`, `"mobile-app"`, `"cron-job"` |

### Example Request Body

```json
{
  "customerName": "John Doe",
  "phoneNumber": "+6583992504",
  "appointmentDate": "2025-01-15",
  "timeSlot": "2:00 PM",
  "app": "dashboard"
}
```

## Response Format

### Success Response (200 OK)

```json
{
  "success": true,
  "message": "Appointment reminder sent to John Doe at +6583992504",
  "data": {
    "messageId": "msg_123456789",
    "status": "sent",
    "timestamp": "2025-01-10T10:30:00Z"
  }
}
```

### Error Responses

#### 400 Bad Request - Missing Required Fields
```json
{
  "success": false,
  "error": "Missing required fields: customerName, phoneNumber, appointmentDate, timeSlot"
}
```

#### 400 Bad Request - Invalid Field Types
```json
{
  "success": false,
  "error": "All required fields must be strings"
}
```

#### 401 Unauthorized - Missing API Key
```json
{
  "success": false,
  "error": "API key required. Please provide x-api-key or apikey header."
}
```

#### 403 Forbidden - Invalid API Key
```json
{
  "success": false,
  "error": "Invalid API key provided."
}
```

#### 500 Internal Server Error - Configuration Issue
```json
{
  "success": false,
  "error": "API key configuration missing. Please contact administrator."
}
```

#### 500 Internal Server Error - WhatsApp API Error
```json
{
  "success": false,
  "error": "Failed to send WhatsApp appointment reminder: API rate limit exceeded"
}
```

## Example Queries

### 1. Basic Appointment Reminder

**Request:**
```bash
curl -X POST https://your-domain.com/api/appointments/ascend \
  -H "Content-Type: application/json" \
  -H "x-api-key: abc123def456ghi789jkl012mno345pq" \
  -d '{
    "customerName": "Alice Johnson",
    "phoneNumber": "+6591234567",
    "appointmentDate": "2025-01-20",
    "timeSlot": "10:30 AM"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Appointment reminder sent to Alice Johnson at +6591234567",
  "data": {
    "messageId": "msg_987654321",
    "status": "sent"
  }
}
```

### 2. Reminder with App Source Tracking

**Request:**
```bash
curl -X POST https://your-domain.com/api/appointments/ascend \
  -H "Content-Type: application/json" \
  -H "apikey: abc123def456ghi789jkl012mno345pq" \
  -d '{
    "customerName": "Bob Chen",
    "phoneNumber": "+6598765432",
    "appointmentDate": "2025-01-22",
    "timeSlot": "2:00 PM",
    "app": "mobile-application"
  }'
```

### 3. Morning Appointment Slot

**Request:**
```bash
curl -X POST https://your-domain.com/api/appointments/ascend \
  -H "Content-Type: application/json" \
  -H "x-api-key: abc123def456ghi789jkl012mno345pq" \
  -d '{
    "customerName": "Sarah Williams",
    "phoneNumber": "+6587654321",
    "appointmentDate": "2025-01-25",
    "timeSlot": "Morning",
    "app": "call-center"
  }'
```

### 4. JavaScript/TypeScript Example

```javascript
// Using fetch API
async function sendAppointmentReminder(customerData) {
  try {
    const response = await fetch('/api/appointments/ascend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ASCEND_API_KEY // Store securely
      },
      body: JSON.stringify({
        customerName: customerData.name,
        phoneNumber: customerData.phone,
        appointmentDate: customerData.date,
        timeSlot: customerData.timeSlot,
        app: 'web-portal'
      })
    });

    const result = await response.json();
    
    if (result.success) {
      console.log('✅ Reminder sent successfully:', result.message);
      return { success: true, data: result.data };
    } else {
      console.error('❌ Failed to send reminder:', result.error);
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error('❌ Network error:', error);
    return { success: false, error: 'Network error occurred' };
  }
}

// Example usage
const customerData = {
  name: "Michael Zhang",
  phone: "+6512345678",
  date: "2025-01-28",
  timeSlot: "3:30 PM"
};

sendAppointmentReminder(customerData);
```

### 5. Python Example

```python
import requests
import json
import os

def send_appointment_reminder(customer_name, phone_number, appointment_date, time_slot, app="python-script"):
    url = "https://your-domain.com/api/appointments/ascend"
    
    headers = {
        "Content-Type": "application/json",
        "x-api-key": os.getenv("ASCEND_API_KEY")  # Store securely
    }
    
    payload = {
        "customerName": customer_name,
        "phoneNumber": phone_number,
        "appointmentDate": appointment_date,
        "timeSlot": time_slot,
        "app": app
    }
    
    try:
        response = requests.post(url, headers=headers, json=payload)
        result = response.json()
        
        if response.status_code == 200 and result.get("success"):
            print(f"✅ Reminder sent successfully: {result['message']}")
            return {"success": True, "data": result.get("data")}
        else:
            print(f"❌ Failed to send reminder: {result.get('error')}")
            return {"success": False, "error": result.get("error")}
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Network error: {str(e)}")
        return {"success": False, "error": "Network error occurred"}

# Example usage
send_appointment_reminder(
    customer_name="Lisa Park",
    phone_number="+6598765432",
    appointment_date="2025-02-01",
    time_slot="11:00 AM",
    app="automated-system"
)
```

### 6. Bulk Reminders Example

```javascript
// Send multiple reminders
async function sendBulkReminders(appointments) {
  const results = [];
  
  for (const appointment of appointments) {
    const result = await fetch('/api/appointments/ascend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ASCEND_API_KEY
      },
      body: JSON.stringify({
        customerName: appointment.customerName,
        phoneNumber: appointment.phoneNumber,
        appointmentDate: appointment.appointmentDate,
        timeSlot: appointment.timeSlot,
        app: 'bulk-processor'
      })
    });
    
    const data = await result.json();
    results.push({
      customer: appointment.customerName,
      success: data.success,
      error: data.error || null
    });
    
    // Add delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  return results;
}

// Example bulk data
const appointments = [
  {
    customerName: "David Lee",
    phoneNumber: "+6591111111",
    appointmentDate: "2025-02-05",
    timeSlot: "9:00 AM"
  },
  {
    customerName: "Emma Wilson",
    phoneNumber: "+6592222222",
    appointmentDate: "2025-02-05",
    timeSlot: "10:30 AM"
  }
];

sendBulkReminders(appointments);
```

## Error Handling Best Practices

### 1. Retry Logic for Temporary Failures

```javascript
async function sendReminderWithRetry(customerData, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('/api/appointments/ascend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ASCEND_API_KEY
        },
        body: JSON.stringify(customerData)
      });

      const result = await response.json();

      if (result.success) {
        return result;
      }

      // Don't retry for client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        throw new Error(result.error);
      }

      // Retry for server errors (5xx)
      if (attempt === maxRetries) {
        throw new Error(`Failed after ${maxRetries} attempts: ${result.error}`);
      }

      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));

    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
    }
  }
}
```

### 2. Comprehensive Error Handling

```javascript
async function handleAppointmentReminder(customerData) {
  try {
    const result = await sendAppointmentReminder(customerData);
    
    if (result.success) {
      // Log success
      console.log(`📱 Reminder sent to ${customerData.name}`);
      
      // Update your database
      await updateReminderStatus(customerData.id, 'sent');
      
      return { success: true };
    }
  } catch (error) {
    console.error(`❌ Failed to send reminder to ${customerData.name}:`, error);
    
    // Update your database
    await updateReminderStatus(customerData.id, 'failed', error.message);
    
    // Send alert to admin if critical
    if (error.message.includes('API key')) {
      await sendAdminAlert('API key issue detected', error.message);
    }
    
    return { success: false, error: error.message };
  }
}
```

## Rate Limiting Guidelines

- **Recommended**: Maximum 10 requests per minute
- **Burst**: Up to 5 requests in quick succession
- **Bulk Operations**: Add 1-2 second delays between requests

## Security Best Practices

1. **Store API keys securely** - Use environment variables, not hardcoded values
2. **Use HTTPS** - Always make requests over secure connections
3. **Validate input** - Sanitize phone numbers and customer names
4. **Log requests** - Monitor API usage for security and debugging
5. **Rotate API keys** - Change keys regularly for security

## Support and Debugging

### Logging Information

All requests are logged with the following information:
- Customer name and phone number
- Timestamp of request
- Source application (`app` parameter)
- Success/failure status
- Error messages (if any)

### Common Issues

1. **Invalid phone number format** - Use international format (+65xxxxxxxx)
2. **Date format issues** - Use YYYY-MM-DD format only
3. **API key not working** - Verify environment variable is set correctly
4. **WhatsApp delivery failures** - Check customer's WhatsApp availability

### Contact

For API support, provide:
- Request timestamp
- Customer phone number (last 4 digits only)
- Error message received
- Source application identifier 