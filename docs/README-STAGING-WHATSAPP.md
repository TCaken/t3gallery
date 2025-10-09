# WhatsApp Staging Environment Setup

This guide explains how to configure the WhatsApp system to route all messages to a test phone number in staging environments, preventing accidental messages to real customers.

## Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Required - Your WhatsApp API key
WHATSAPP_API_KEY=your_api_key_here

# Required - Environment setting (controls staging behavior)
NEXT_PUBLIC_ENVIRONMENT=development  # or staging, production

# Optional - Test phone number for staging (include country code)
STAGING_TEST_PHONE=+6512345678
```

## How It Works

### Production Environment
- `NEXT_PUBLIC_ENVIRONMENT=production`
- Messages are sent to the actual recipient phone numbers
- Normal operation

### Staging/Development Environment
- `NEXT_PUBLIC_ENVIRONMENT=development` or `NEXT_PUBLIC_ENVIRONMENT=staging`
- If `STAGING_TEST_PHONE` is configured, ALL WhatsApp messages are redirected to this test number
- Original recipient phone numbers are logged for tracking

## Environment-Specific Behavior

| NEXT_PUBLIC_ENVIRONMENT | STAGING_TEST_PHONE | Behavior |
|-------------------------|-------------------|----------|
| production | Any value | Messages sent to actual recipients |
| development/staging | Not set | Messages sent to actual recipients (be careful!) |
| development/staging | Set | ALL messages redirected to test number |

## Example Configuration

### Development/Staging (.env.local)
```bash
NEXT_PUBLIC_ENVIRONMENT=development  # or staging
WHATSAPP_API_KEY=your_staging_api_key
STAGING_TEST_PHONE=+6512345678
```

### Production (.env.production)
```bash
NEXT_PUBLIC_ENVIRONMENT=production
WHATSAPP_API_KEY=your_production_api_key
# STAGING_TEST_PHONE not set or ignored in production
```

## Logging

When staging redirect is active, you'll see console logs like:
```
🧪 STAGING MODE: Redirecting message from +6598765432 to test number +6512345678
```

The original phone numbers are also preserved in the database logs for tracking:
- `templateUsageLog` table includes `staging_info` with original phone details
- `appointmentReminderLog` table includes `original_phone_number` when redirected

## Functions Affected

The following functions automatically use staging redirect when configured:
- `sendWhatsAppMessage()` - Template-based messages
- `sendAutoTriggeredMessage()` - Status change triggered messages  
- `ascendAppointmentReminder()` - Appointment reminder messages

## Safety Features

1. **Production Protection**: Staging redirect is completely disabled when `NEXT_PUBLIC_ENVIRONMENT=production`
2. **Explicit Configuration**: Redirect only happens when `STAGING_TEST_PHONE` is explicitly set
3. **Audit Trail**: Original phone numbers are preserved in logs
4. **Clear Logging**: Console output clearly indicates when staging mode is active

## Testing

To test the staging functionality:

1. Set `NEXT_PUBLIC_ENVIRONMENT=development` or `NEXT_PUBLIC_ENVIRONMENT=staging`
2. Configure `STAGING_TEST_PHONE` with your test number
3. Send a WhatsApp message through any of the functions
4. Verify the message arrives at your test number instead of the original recipient
5. Check the logs to confirm the redirect was logged properly

**Example .env.local for testing:**
```bash
NEXT_PUBLIC_ENVIRONMENT=development
WHATSAPP_API_KEY=your_api_key_here
STAGING_TEST_PHONE=+6512345678
``` 