# Google Sheets Appointment Status Update System

## Overview

This new system replaces the Excel-based appointment status updates with a more sophisticated Google Sheets integration that supports live updates and intelligent lead/appointment management.

## Key Features

### 🔄 **Live Mode** (Real-time Updates)
- Processes Google Sheets data for today's appointments in real-time
- Automatically updates appointment statuses based on UW field completion
- Smart lead and appointment creation/management

### 🌅 **End-of-Day Mode** (Final Processing)
- Processes all done appointments for final loan status updates
- Changes leads/borrowers to `missed/RS` if loan status is `RS`

## API Endpoints

### Main Endpoint
```
POST /api/appointments/status-update
```

### Parameters

#### **Live Mode (Default)**
```json
{
  "mode": "live",
  "thresholdHours": 3,
  "googleSheetData": {
    "rows": [...],
    "spreadsheet_id": "your-sheet-id",
    "spreadsheet_name": "Your Sheet Name",
    "sheet": "Sheet1"
  }
}
```

#### **End-of-Day Mode**
```json
{
  "mode": "end_of_day",
  "thresholdHours": 3
}
```

### Google Sheets Row Format
```json
{
  "row_number": 1,
  "col_Date": "25/12/24",
  "col_UW": "Data filled here",  // Key field!
  "col_Code": "P",               // P, RS, R, PRS
  "col_Full Name": "John Doe",
  "col_Mobile Number": "91234567",
  "col_New or Reloan? ": "New Loan - 新贷款",  // or "Re Loan - 再贷款"
  "col_RS": "Reason if RS",
  "col_RS -Detailed": "Detailed reason"
}
```

## Smart Logic Flow

### 📝 **New Loan Cases** (`col_New or Reloan? ` = "New Loan - 新贷款")

#### **Scenario A: No Lead Exists**
1. ✅ **Create new lead** with SEO source
2. ✅ **Check eligibility** automatically
3. ✅ **Create appointment** at nearest available timeslot (if eligible)

#### **Scenario B: Lead Exists, No Appointments**
1. ✅ **Create appointment** at nearest available timeslot

#### **Scenario C: Lead Exists, Appointment on Different Date**
1. ✅ **Move appointment** to nearest available timeslot for today

#### **Scenario D: Lead Exists, Appointment Today**
1. ✅ **Update appointment status** based on Google Sheets data

### 🔄 **Reloan Cases** (`col_New or Reloan? ` = "Re Loan - 再贷款")
- Handles borrower appointments using same logic as lead appointments

## Status Determination Logic

### **Appointment Turned Up** (Determined by UW field)
- ✅ **UW field has data** → Appointment = `done`, Lead = `done`
- ✅ **Code = "P"** → Appointment = `done`, Lead = `done`

### **Appointment Status Based on Code**
| Code | Appointment Status | Lead Status | Loan Status | Notes |
|------|-------------------|-------------|-------------|-------|
| `P` | `done` | `done` | `P` | Completed successfully |
| `PRS` | `done` | `done` | `PRS` | Customer rejected |
| `RS` | `done` | `missed/RS` | `RS` | System rejected |
| `R` | `done` | `done` | `R` | Rejected + triggers webhook |

### **Late Appointments**
- ⏰ **Threshold exceeded** (default 3 hours) → Appointment = `missed`, Lead = `missed/RS`
- 🔄 **Can be reversed** if customer returns and UW field is filled

## Webhook Integration

### Google Sheets → API
Configure your Google Sheets to send webhook data to:
```
POST https://your-domain.com/api/appointments/status-update
```

### Form Data Format
```
rows: [JSON array of sheet rows]
mode: "live" | "end_of_day"
thresholdHours: 3
spreadsheet_id: "your-sheet-id"
spreadsheet_name: "Your Sheet Name"
sheet: "Sheet1"
```

## Manual Testing

### Live Mode Test
```
GET /api/appointments/status-update?mode=live&thresholdHours=3
```

### End-of-Day Test
```
GET /api/appointments/status-update?mode=end_of_day&thresholdHours=3
```

## Response Format

```json
{
  "success": true,
  "mode": "live",
  "message": "Live appointment processing completed successfully",
  "todaySingapore": "2024-12-25",
  "thresholdHours": 3,
  "results": [
    {
      "action": "create_lead",
      "leadId": "123",
      "message": "Created new lead 123 for John Doe",
      "success": true
    },
    {
      "action": "create_appointment", 
      "leadId": "123",
      "appointmentId": "456",
      "message": "Created appointment for new lead at 2024-12-25T10:30:00",
      "success": true
    }
  ],
  "summary": {
    "totalActions": 2,
    "successful": 2,
    "failed": 0,
    "actionTypes": {
      "leads_created": 1,
      "appointments_created": 1,
      "appointments_moved": 0,
      "appointments_updated": 0,
      "timeout_updates": 0
    }
  }
}
```

## Action Types Explained

| Action | Description |
|--------|-------------|
| `create_lead` | Created a new lead that didn't exist in system |
| `create_appointment` | Created new appointment for existing lead |
| `move_appointment` | Moved existing appointment to nearest timeslot |
| `update_appointment` | Updated existing appointment status |
| `update_borrower_appointment` | Updated borrower appointment status |
| `timeout_appointment` | Marked appointment as missed due to threshold |
| `final_status_update` | End-of-day final status updates |

## Security Features

- 🔒 **PII Censoring**: All webhook payloads use censored PII data
- 🔐 **Authentication**: Requires valid authentication for manual endpoints
- ✅ **Input Validation**: Comprehensive validation of Google Sheets data
- 🛡️ **Error Handling**: Graceful handling of malformed data

## Timezone Handling

- 🌏 **Singapore Timezone (UTC+8)**: All date/time processing uses Singapore timezone
- 📅 **Date Parsing**: Supports DD/MM/YY and DD/MM/YYYY formats
- ⏰ **UTC Storage**: Database stores all timestamps in UTC

## Next Steps

1. **Configure Google Sheets webhook** to call the new endpoint
2. **Test with sample data** to ensure proper functionality  
3. **Monitor logs** for any edge cases or errors
4. **Set up scheduling** for end-of-day mode processing

---

## Migration from Old System

The old Excel-based system is preserved for backwards compatibility. The new system provides:

- ✅ **Real-time processing** vs batch processing
- ✅ **Smart lead management** vs manual lead creation
- ✅ **Automatic appointment scheduling** vs manual scheduling
- ✅ **PII protection** vs raw data exposure
- ✅ **Better error handling** vs limited error reporting 