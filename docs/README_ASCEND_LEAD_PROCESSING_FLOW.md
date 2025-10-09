# Ascend Lead Processing Flow

## Overview

The Ascend Lead Processing Flow is a comprehensive system that automatically handles lead creation and management based on phone number eligibility checks. This flow integrates with the manual verification API to provide intelligent lead processing.

## Flow Logic

### 1. Phone Number Processing
- Takes a phone number from the request
- Formats it to Singapore standard (+65XXXXXXXX)
- Validates the phone number format

### 2. Eligibility Check
- Checks the phone number against ATOM/CAPC lists via API
- Searches for existing leads in AirConnect database
- Determines the appropriate action based on results

### 3. Lead Processing Scenarios

#### Scenario A: New Lead (Eligible)
**Condition**: Phone number not found in any lists or existing leads
**Action**: 
- Creates a new lead with `lead_type: 'new'`
- Sets `ascend_status: 'manual_verification_required'`
- Attaches the `airconnect_verification_link`
- Stores manual verification log entry

#### Scenario B: Reloan Customer
**Condition**: Phone number found in ATOM/CAPC lists
**Action**:
- **No new lead created** (reloan customers have separate flow)
- Returns `ascend_status: 'reloan_customer_identified'`
- Stores manual verification log entry
- **Note**: Reloan customers should use the dedicated reloan API endpoint

#### Scenario C: Duplicate Lead
**Condition**: Phone number exists in AirConnect database
**Action**:
- Updates existing lead's `ascend_status` to `'manual_verification_required'`
- Updates existing lead's `airconnect_verification_link`
- Stores manual verification log entry
- Does NOT create a new lead

## API Endpoints

### 1. Manual Verification with Lead Processing (New/Duplicate Leads)
**Endpoint**: `POST /api/ascend/leads/manualverify`

### 2. Reloan Customer Processing (CAPC List Customers)
**Endpoint**: `POST /api/ascend/leads/reloan`

### 3. Appointment Reminder with Lead Processing
**Endpoint**: `POST /api/appointments/ascend`

**Headers**:
```
Content-Type: application/json
x-api-key: YOUR_ASCEND_API_KEY
```

**Request Body (Manual Verification)**:
```json
{
  "customerName": "John Doe",
  "phoneNumber": "+6591234567",
  "customerHyperLink": "https://ascend.example.com/customer/12345",
  "app": "ascend-portal"
}
```

**Request Body (Appointment Reminder)**:
```json
{
  "customerName": "Jane Smith",
  "phoneNumber": "+6598765432",
  "appointmentDate": "2024-01-20",
  "timeSlot": "2:00 PM",
  "app": "ascend-portal"
}
```

**Response Examples**:

#### New Lead Response
```json
{
  "success": true,
  "message": "New lead created successfully. Lead ID: 123. Manual verification stored successfully for John Doe",
  "data": {
    "leadProcessing": {
      "leadId": 123,
      "leadType": "new",
      "ascendStatus": "manual_verification_required",
      "airconnectLink": "https://ascend.example.com/customer/12345",
      "eligibilityResult": {
        "isEligible": true,
        "status": "new",
        "notes": "Not found in any lists or existing leads"
      }
    },
    "verification": {
      "id": 456,
      "customerName": "John Doe",
      "phoneNumber": "+6591234567",
      "customerHyperLink": "https://ascend.example.com/customer/12345",
      "app": "ascend-portal",
      "createdAt": "2024-01-15T10:30:00.000Z"
    }
  }
}
```

#### Reloan Customer Response (from /api/ascend/leads/reloan)
```json
{
  "success": true,
  "message": "Reloan customer processed successfully. Phone: +6598765432. Manual verification stored successfully for Jane Smith",
  "data": {
    "reloanProcessing": {
      "leadType": "reloan",
      "ascendStatus": "reloan_customer_processed",
      "airconnectLink": "https://ascend.example.com/customer/67890",
      "note": "Reloan customer - ready for reloan workflow"
    },
    "verification": {
      "id": 457,
      "customerName": "Jane Smith",
      "phoneNumber": "+6598765432",
      "customerHyperLink": "https://ascend.example.com/customer/67890",
      "app": "ascend-reloan",
      "createdAt": "2024-01-15T10:35:00.000Z"
    }
  }
}
```

#### Reloan Customer Response (from /api/ascend/leads/manualverify - when CAPC detected)
```json
{
  "success": true,
  "message": "Reloan customer identified in CAPC lists. No new lead created - separate reloan flow required. Manual verification stored successfully for Jane Smith",
  "data": {
    "leadProcessing": {
      "leadType": "reloan",
      "ascendStatus": "reloan_customer_identified",
      "airconnectLink": "https://ascend.example.com/customer/67890",
      "note": "This customer should be processed through the reloan customer flow"
    },
    "verification": {
      "id": 457,
      "customerName": "Jane Smith",
      "phoneNumber": "+6598765432",
      "customerHyperLink": "https://ascend.example.com/customer/67890",
      "app": "ascend-manual-verify",
      "createdAt": "2024-01-15T10:35:00.000Z"
    }
  }
}
```

#### Duplicate Lead Response
```json
{
  "success": true,
  "message": "Duplicate lead updated successfully. Lead ID: 123. Manual verification stored successfully for Bob Johnson",
  "data": {
    "leadProcessing": {
      "leadId": 123,
      "leadType": "duplicate",
      "ascendStatus": "manual_verification_required",
      "airconnectLink": "https://ascend.example.com/customer/11111",
      "eligibilityResult": {
        "isEligible": false,
        "status": "unqualified",
        "notes": "Phone number already exists in leads 123 with status new"
      }
    },
    "verification": {
      "id": 458,
      "customerName": "Bob Johnson",
      "phoneNumber": "+6591234567",
      "customerHyperLink": "https://ascend.example.com/customer/11111",
      "app": "ascend-portal",
      "createdAt": "2024-01-15T10:40:00.000Z"
    }
  }
}
```

#### Appointment Reminder Response (New Lead)
```json
{
  "success": true,
  "message": "New lead created for appointment. Lead ID: 125. Appointment reminder sent to Alice Johnson at +6591111111",
  "data": {
    "leadProcessing": {
      "leadId": 125,
      "leadType": "new",
      "ascendStatus": "booking_appointment",
      "airconnectLink": "Appointment: 2024-01-20 2:00 PM",
      "eligibilityResult": {
        "isEligible": true,
        "status": "new",
        "notes": "Not found in any lists or existing leads"
      }
    },
    "reminder": {
      "success": true,
      "data": { /* WhatsApp API response */ },
      "message": "Appointment reminder sent to Alice Johnson at +6591111111",
      "logId": 789
    }
  }
}
```

#### Appointment Reminder Response (Duplicate Lead)
```json
{
  "success": true,
  "message": "Duplicate lead updated for appointment. Lead ID: 123. Appointment reminder sent to Bob Johnson at +6591234567",
  "data": {
    "leadProcessing": {
      "leadId": 123,
      "leadType": "duplicate",
      "ascendStatus": "booking_appointment",
      "airconnectLink": "Appointment: 2024-01-21 3:00 PM",
      "eligibilityResult": {
        "isEligible": false,
        "status": "unqualified",
        "notes": "Phone number already exists in leads 123 with status new"
      }
    },
    "reminder": {
      "success": true,
      "data": { /* WhatsApp API response */ },
      "message": "Appointment reminder sent to Bob Johnson at +6591234567",
      "logId": 790
    }
  }
}
```

## Database Changes

### New Fields Added
- `manual_verification_log.request_body` - Stores complete request body for debugging
- `appointment_reminder_log.request_body` - Stores complete request body for debugging

### Lead Status Updates
- `leads.ascend_status` - Updated to `'manual_verification_required'` for all processed leads
- `leads.airconnect_verification_link` - Updated with the provided hyperlink
- `leads.lead_type` - Set to `'new'` or `'reloan'` based on eligibility results

## Testing

Use the provided test script to verify the flow:

```bash
node test-ascend-lead-processing.js
```

Make sure to:
1. Set your actual API key in the test script
2. Run the database migration first
3. Test with different phone numbers to see different scenarios

## Benefits

1. **Automated Lead Classification**: Automatically determines if a lead is new, reloan, or duplicate
2. **Complete Request Logging**: Full request bodies are stored for debugging and review
3. **Intelligent Processing**: Different actions based on eligibility results
4. **Consistent Status Management**: All processed leads get proper ascend_status and verification links
5. **Audit Trail**: Complete logging of all processing steps and decisions

## Error Handling

The system handles various error scenarios:
- Invalid phone number formats
- API failures during eligibility checks
- Database errors during lead creation/updates
- Missing required fields in requests

All errors are logged with detailed information for debugging.
