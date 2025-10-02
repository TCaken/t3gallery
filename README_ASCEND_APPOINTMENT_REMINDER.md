# Ascend Appointment Reminder

This document explains how to use the new `ascendAppointmentReminder` function to send WhatsApp appointment reminders using a hardcoded template.

## Function Overview

The `ascendAppointmentReminder` function sends a WhatsApp message using a predefined template for appointment reminders.

### Function Signature

```typescript
export async function ascendAppointmentReminder(
  customerName: string,
  phoneNumber: string,
  appointmentDate: string,
  timeSlot: string,
  app?: string
): Promise<{
  success: boolean;
  data?: any;
  message?: string;
  error?: string;
  logId?: number;
}>
```

### Parameters

- `customerName` (string): The customer's name (e.g., "TAN")
- `phoneNumber` (string): The customer's phone number (e.g., "+6583992504")
- `appointmentDate` (string): The appointment date in YYYY-MM-DD format (e.g., "2025-07-17")
- `timeSlot` (string): The time slot description (e.g., "Noon", "Morning", "2:00 PM")
- `app` (string, optional): Who is requesting this reminder (e.g., "dashboard", "mobile-app", "cron-job"). Defaults to "unknown"

## Usage Examples

### 1. Direct Function Call

```typescript
import { ascendAppointmentReminder } from '~/app/_actions/whatsappActions';

// Send appointment reminder
const result = await ascendAppointmentReminder(
  "TAN",
  "+6583992504", 
  "2025-07-17",
  "Noon",
  "dashboard" // Specify who is requesting this
);

if (result.success) {
  console.log("Reminder sent successfully:", result.message);
  console.log("Log ID:", result.logId); // You can track this in your logs
} else {
  console.error("Failed to send reminder:", result.error);
}
```

### 2. API Endpoint Usage

You can also use the API endpoint directly. **API key authentication is required:**

```typescript
// Frontend call - requires API key in headers
const response = await fetch('/api/appointments/ascend', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'your-api-key-here', // Required: API key for authentication
    // OR
    // 'apikey': 'your-api-key-here', // Alternative header name
  },
  body: JSON.stringify({
    customerName: "TAN",
    phoneNumber: "+6583992504",
    appointmentDate: "2025-07-17",
    timeSlot: "Noon",
    app: "frontend-dashboard" // Optional: specify the requesting app
  })
});

const result = await response.json();
if (result.success) {
  console.log("Reminder sent:", result.message);
  console.log("Log ID:", result.logId);
} else {
  console.error("Error:", result.error);
}
```

### API Authentication

The API endpoint is protected with API key authentication:

- **Headers Required:** `x-api-key` or `apikey`
- **Environment Variable:** `ASCEND_API_KEY` must be set on the server
- **Status Codes:**
  - `401` - Missing API key
  - `403` - Invalid API key
  - `500` - API key not configured on server

**Example cURL request:**
```bash
curl -X POST https://your-domain.com/api/appointments/ascend \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-api-key-here" \
  -d '{
    "customerName": "TAN",
    "phoneNumber": "+6583992504",
    "appointmentDate": "2025-07-17",
    "timeSlot": "Noon",
    "app": "external-system"
  }'
```

### 3. Integration with Appointments Page

Here's how you could add a "Send Reminder" button to appointment cards:

```typescript
// In your appointment component
const handleSendReminder = async (appointment: UnifiedAppointment) => {
  const customerName = appointment.type === 'lead' 
    ? appointment.lead?.full_name 
    : appointment.borrower?.name;
  
  const phoneNumber = appointment.type === 'lead'
    ? appointment.lead?.phone_number
    : `+65${appointment.borrower?.phone}`;
  
  const appointmentDate = format(new Date(appointment.start_datetime), 'yyyy-MM-dd');
  const timeSlot = format(new Date(appointment.start_datetime), 'h:mm a');
  
  if (customerName && phoneNumber) {
    const result = await ascendAppointmentReminder(
      customerName,
      phoneNumber,
      appointmentDate,
      timeSlot,
      "appointments-page" // Track that this came from the appointments page
    );
    
    if (result.success) {
      alert(`Appointment reminder sent successfully! (Log ID: ${result.logId})`);
    } else {
      alert(`Failed to send reminder: ${result.error}`);
    }
  }
};

// Add button to your JSX
<button 
  onClick={() => handleSendReminder(appointment)}
  className="px-2 py-1 bg-blue-600 text-white rounded text-xs"
>
  Send Reminder
</button>
```

## Template Configuration

The function uses these hardcoded values:

- **Workspace ID**: `976e3394-ae10-4b32-9a23-8ecf78da9fe7`
- **Channel ID**: `9e7a1a3d-48de-59aa-aeb4-dc21ab0cce8b`
- **Project ID**: `20144ad5-88f2-4336-be9e-9c30b2c0a89b`

### Template Parameters

The template expects these parameters:
- `customer_name`: The customer's name
- `appt_date`: The appointment date
- `time_slot`: The time slot description

## Requirements

- User must be authenticated (Clerk auth) for direct function calls
- Environment variables must be set:
  - `WHATSAPP_API_KEY` - For WhatsApp API access
  - `ASCEND_API_KEY` - For API endpoint authentication
- Phone numbers are automatically formatted using the existing `formatPhoneNumber` function

## Error Handling

The function returns a standardized response:

```typescript
// Success response
{
  success: true,
  data: {...}, // WhatsApp API response
  message: "Appointment reminder sent to [name] at [phone]"
}

// Error response
{
  success: false,
  error: "Error message description"
}
```

## Environment Setup

### Required Environment Variables

Add these to your `.env` file:

```bash
# For WhatsApp API access
WHATSAPP_API_KEY=your-whatsapp-api-key-here

# For Ascend API endpoint authentication
ASCEND_API_KEY=your-secure-api-key-here
```

### Security Best Practices

1. **Generate a strong API key** for `ASCEND_API_KEY`
2. **Keep API keys secure** - never commit them to version control
3. **Rotate API keys regularly** for security
4. **Use different API keys** for different environments (dev, staging, prod)

**Example API key generation:**
```bash
# Generate a secure random API key
openssl rand -hex 32
# Or use Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Error Handling Examples

### API Key Errors

```typescript
const response = await fetch('/api/appointments/ascend', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'invalid-key'
  },
  body: JSON.stringify({...})
});

const result = await response.json();

switch (response.status) {
  case 401:
    console.error('Missing API key:', result.error);
    break;
  case 403:
    console.error('Invalid API key:', result.error);
    break;
  case 500:
    console.error('Server configuration error:', result.error);
    break;
  default:
    if (result.success) {
      console.log('Success:', result.message);
    } else {
      console.error('Request failed:', result.error);
    }
}
```

## Database Logging

All appointment reminder attempts are logged to the `appointment_reminder_log` table with the following information:

### Logged Fields
- `customer_name`: The customer's name
- `phone_number`: Formatted phone number
- `appointment_date`: The appointment date
- `time_slot`: The time slot
- `app`: Who requested the reminder
- `status`: `pending` → `sent` or `failed`
- `api_response`: Full WhatsApp API response
- `error_message`: Error details if failed
- `workspace_id`, `channel_id`, `project_id`: Template configuration
- `sent_at`: Timestamp of the attempt
- `sent_by`: User ID who triggered the reminder

### Database Migration

Run the following migration to create the logging table:

```sql
-- This file: drizzle/0001_appointment_reminder_log.sql
-- Run: npx drizzle-kit push
```

### Querying Logs

You can query the logs to see reminder history:

```typescript
import { db } from "~/server/db";
import { appointmentReminderLog } from "~/server/db/schema";
import { eq, desc } from 'drizzle-orm';

// Get all reminders for a specific phone number
const reminders = await db.select()
  .from(appointmentReminderLog)
  .where(eq(appointmentReminderLog.phone_number, "+6583992504"))
  .orderBy(desc(appointmentReminderLog.sent_at));

// Get failed reminders
const failedReminders = await db.select()
  .from(appointmentReminderLog)
  .where(eq(appointmentReminderLog.status, 'failed'))
  .orderBy(desc(appointmentReminderLog.sent_at));

// Get reminders by app
const dashboardReminders = await db.select()
  .from(appointmentReminderLog)
  .where(eq(appointmentReminderLog.app, 'dashboard'))
  .orderBy(desc(appointmentReminderLog.sent_at));
```

## Notes

- Phone numbers are automatically formatted using the existing `formatPhoneNumber` utility
- The function logs all requests and responses for debugging
- **API endpoint requires API key authentication** - unauthorized requests will be rejected
- Direct function calls require Clerk authentication - unauthenticated users will receive an error
- The function uses the same WhatsApp API endpoint as other templates in the system
- Each reminder attempt creates a log entry that tracks success/failure and response details
- The `app` parameter helps you track which part of your system is sending the most reminders
- **Security:** API keys are validated on every request and logged for audit purposes 