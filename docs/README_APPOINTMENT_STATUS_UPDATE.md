# Appointment Status Update API

This system provides automated appointment status updates based on Excel data and time thresholds.

## Recent Updates (January 2025)
- **Updated Excel Data Format**: Modified to support new spreadsheet column structure with proper field names (e.g., `"col_Mobile Number"`, `"col_Full Name"`)
- **Enhanced Field Mapping**: Updated phone number matching logic to work with the new `"col_Mobile Number"` field
- **Improved Type Safety**: Added comprehensive TypeScript interfaces for all Excel fields

## Features

### 1. Automatic Status Updates
- **Time-based Updates**: Automatically marks appointments as "missed" if they're 2.5+ hours past their scheduled time
- **Excel-based Updates**: Updates appointment statuses based on Excel data with specific codes:
  - `P`, `PRS` → Appointment: Done, Lead: Done  
  - `RS` → Appointment: Done, Lead: missed/rs
- **Same-day Processing**: Only processes appointments scheduled for today (Singapore timezone)

### 2. API Endpoints

#### POST `/api/appointments/status-update`
Updates appointment statuses with optional Excel data.

**Request Body:**
```json
{
  "excelData": {
    "rows": [
      {
        "row_number": 2,
        "col_Code": "P",
        "col_Mobile_Number": "90280520",
        "col_Full_Name": "JOHN DOE",
        // ... other Excel columns
      }
    ],
    "spreadsheet_id": "...",
    "spreadsheet_name": "...",
    "sheet": "..."
  },
  "thresholdHours": 2.5
}
```

**Response:**
```json
{
  "success": true,
  "message": "Processed 5 appointments, updated 2",
  "processed": 5,
  "updated": 2,
  "results": [
    {
      "appointmentId": 123,
      "leadId": 456,
      "leadName": "John Doe",
      "oldAppointmentStatus": "upcoming",
      "newAppointmentStatus": "done",
      "oldLeadStatus": "booked",
      "newLeadStatus": "done",
      "reason": "Excel Code: P → Done",
      "appointmentTime": "14:30",
      "timeDiffHours": "1.25"
    }
  ],
  "todaySingapore": "2025-01-09",
  "thresholdHours": 2.5
}
```

#### GET `/api/appointments/status-update`
Test endpoint that processes appointments without Excel data (time-based only).

**Query Parameters:**
- `thresholdHours` (optional): Default 2.5

### 3. Server Actions

#### `updateAppointmentStatuses(excelData?, thresholdHours?)`
Main function to update appointment statuses with optional Excel data.

#### `updateAppointmentStatusesByTime(thresholdHours?)`
Update appointments based on time threshold only (no Excel data).

#### `testAppointmentStatusUpdate()`
Test the functionality with current appointments.

### 4. UI Integration

The appointments dashboard (`/dashboard/appointments`) includes:
- **Update Status (2.5h)** button: Triggers time-based status updates
- **Test Update** button: Tests the functionality
- **Results Display**: Shows detailed results of status updates

### 5. Excel Data Format

The system expects Excel data with these key columns (new format):
- `"col_Mobile Number"`: Used to match with lead phone numbers  
- `col_Code`: Status code (P, PRS, RS)
- `"col_Full Name"`: Lead name for reference
- `col_Timestamp`: Application timestamp
- `col_UW`: Underwriter name
- `"col_Loan Portal Applied"`: Source of the lead application
- `"col_New or Reloan? "`: Type of loan application

**Full field structure:**
```json
{
  "row_number": 258,
  "col_Timestamp": "04/06/25",
  "col_UW": "Joey",
  "col_RM": "",
  "col_Group": "",
  "col_Code": "R",
  "col_Loan Portal Applied": "1%",
  "col_Manual": "",
  "col_Reason for manual": "",
  "col_Full Name": "LOGES (NEW)",
  "col_Mobile Number": "93550901",
  "col_H/P": "",
  "col_New or Reloan? ": "New Loan - 新贷款",
  "col_RS": "",
  "col_RS -Detailed": "",
  "col_Please choose your nationality or Work Pass ": "",
  "col_Last 4 digits of the NRIC (including the alphabet)": "",
  "col_Marital Status": "",
  "col_Your Employment Specialisation": "",
  "col_Email Address": "",
  "col_Monthly Income": "",
  "col_Loan Amount Applying?": "",
  "col_Are you a Declared Bankruptcy at the time of this loan application?": "",
  "col_Which year is your bankruptcy discharge?": "",
  "col_What is your work designation?": "",
  "col_For how long have you been working in this company?": "",
  "col_Place of Residence": "",
  "col_Number of Room HDB Flat": "",
  "col_What is the purpose of the Loan?": "",
  "col_How many Moneylender Company do you currently have outstanding loan?": "",
  "col_**Declaration - 声明 ** ": "",
  "col_Employment Type": ""
}
```

Phone numbers are cleaned (removing non-digits) for matching. The system uses `"col_Mobile Number"` field to match against lead phone numbers in the database.

### 6. Business Logic

#### Status Update Rules:
1. **Excel Match Found:**
   - Code `P` or `PRS`: Appointment → Done, Lead → Done
   - Code `RS`: Appointment → Done, Lead → missed/rs
   
2. **No Excel Match + Time Threshold Exceeded:**
   - Appointment → Missed, Lead → follow_up
   
3. **No Excel Match + Within Time Threshold:**
   - No changes made

#### Timezone Handling:
- All calculations use Singapore timezone (UTC+8)
- Only processes appointments scheduled for "today" in Singapore time
- Time differences calculated in Singapore timezone

### 7. Usage Examples

#### Basic Time-based Update:
```typescript
import { updateAppointmentStatusesByTime } from '~/app/_actions/appointmentStatusUpdateAction';

const result = await updateAppointmentStatusesByTime(2.5);
console.log(`Updated ${result.updated} appointments`);
```

#### With Excel Data:
```typescript
import { updateAppointmentStatuses } from '~/app/_actions/appointmentStatusUpdateAction';

const excelData = {
  rows: [/* Excel rows */],
  spreadsheet_id: "...",
  spreadsheet_name: "...",
  sheet: "..."
};

const result = await updateAppointmentStatuses(excelData, 2.5);
```

#### Test Functionality:
```typescript
import { testAppointmentStatusUpdate } from '~/app/_actions/appointmentStatusUpdateAction';

const result = await testAppointmentStatusUpdate();
```

### 8. Test Example with New Data Format

#### Testing with Your Spreadsheet Data:
```typescript
import { updateAppointmentStatuses } from '~/app/_actions/appointmentStatusUpdateAction';

// Example using your actual spreadsheet structure
const testExcelData = {
  rows: [
    {
      "row_number": 258,
      "col_Timestamp": "04/06/25",
      "col_UW": "Joey",
      "col_RM": "",
      "col_Group": "",
      "col_Code": "P", // This will mark appointment as done
      "col_Loan Portal Applied": "1%",
      "col_Manual": "",
      "col_Reason for manual": "",
      "col_Full Name": "LOGES (NEW)",
      "col_Mobile Number": "93550901", // Used for matching
      "col_H/P": "",
      "col_New or Reloan? ": "New Loan - 新贷款",
      // ... other fields
    },
    {
      "row_number": 259,
      "col_Timestamp": "04/06/2025 17:36:22",
      "col_UW": "Joey",
      "col_Code": "RS", // This will mark as done with special RS status
      "col_Full Name": "MUHAMMED FAIRUZ (NEW)",
      "col_Mobile Number": "96706474",
      // ... other fields
    }
  ],
  "spreadsheet_id": "1bzfyvIcfzWVX3RpHpV2crFJRVRcDGDJqR8kRBn-epE8",
  "spreadsheet_name": "Crawfort New Application Form 2024/2025(Responses)",
  "sheet": "[caken] Jun 2025"
};

// Call the API
const result = await updateAppointmentStatuses(testExcelData, 2.5);
console.log('Update Results:', result);
```

#### Expected Behavior:
- **Phone Number Matching**: System will clean phone numbers (remove formatting) and match `"col_Mobile Number"` against lead phone numbers
- **Code Processing**: 
  - `col_Code: "P"` → Appointment: Done, Lead: Done
  - `col_Code: "RS"` → Appointment: Done, Lead: missed/rs  
  - `col_Code: "R"` → No status change (not a recognized completion code)
- **Time-based Fallback**: If no Excel match found and appointment is 2.5+ hours late → Appointment: Missed, Lead: follow_up

### 9. Error Handling

- **Authentication**: All endpoints require user authentication
- **Graceful Failures**: Individual appointment update failures don't stop the entire process
- **Detailed Logging**: Comprehensive console logging for debugging
- **Error Responses**: Clear error messages with details

### 10. Cron/Scheduled Usage

This API can be integrated with cron jobs or scheduled tasks:

```bash
# Example cron job (every 30 minutes during business hours)
*/30 9-18 * * 1-5 curl -X GET "https://your-domain.com/api/appointments/status-update?thresholdHours=2.5"
```

### 11. Testing

Use the UI buttons in the appointments dashboard or call the API directly:

```bash
# Test without Excel data
curl -X GET "http://localhost:3000/api/appointments/status-update?thresholdHours=2.5"

# Test with Excel data
curl -X POST "http://localhost:3000/api/appointments/status-update" \
  -H "Content-Type: application/json" \
  -d '{"thresholdHours": 2.5}'
``` 