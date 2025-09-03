# LeadCard Display Test Cases

## Updated LeadCard Behavior

The LeadCard component now displays different information based on the `ascend_status` and `airconnect_verification_link`:

### 1. Manual Verification Required
**When:** `ascend_status = 'manual_verification_required'` and `airconnect_verification_link` starts with `http`

**Display:**
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️  Manual Verification Required    [Verify in Ascend] │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- Shows orange warning section
- "Verify in Ascend" button opens the hyperlink in new tab
- Only shows button if link starts with `http`

### 2. Booking Appointment
**When:** `ascend_status = 'booking_appointment'` and `airconnect_verification_link` starts with `Appointment:`

**Display:**
```
┌─────────────────────────────────────────────────────────┐
│ 📅 Ready for Booking                                   │
│    2024-01-20 2:00 PM                                  │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- Shows blue appointment section
- Displays appointment date and time (extracted from the link)
- No clickable button (just informational)

### 3. Debug Mode (Development)
**When:** `NEXT_PUBLIC_ENVIRONMENT = 'development'`

**Display:**
```
┌─────────────────────────────────────────────────────────┐
│ Debug: ascend_status = "booking_appointment"            │
│ airconnect_link = "Appointment: 2024-01-20 2:00 PM"    │
│ 📅 Appointment Info: 2024-01-20 2:00 PM                │
└─────────────────────────────────────────────────────────┘
```

**Or for manual verification:**
```
┌─────────────────────────────────────────────────────────┐
│ Debug: ascend_status = "manual_verification_required"   │
│ airconnect_link = "https://ascend.example.com/customer/12345" │
│ 🔗 Verification Link: https://ascend.example.com/customer/12345 │
└─────────────────────────────────────────────────────────┘
```

## Test Scenarios

### Scenario 1: Manual Verification Lead
```json
{
  "ascend_status": "manual_verification_required",
  "airconnect_verification_link": "https://ascend.example.com/customer/12345"
}
```
**Expected:** Orange section with "Verify in Ascend" button

### Scenario 2: Appointment Booking Lead
```json
{
  "ascend_status": "booking_appointment", 
  "airconnect_verification_link": "Appointment: 2024-01-20 2:00 PM"
}
```
**Expected:** Blue section showing "Ready for Booking" with appointment time

### Scenario 3: Appointment Booking Lead (Different Format)
```json
{
  "ascend_status": "booking_appointment",
  "airconnect_verification_link": "Appointment: 2024-01-21 3:00 PM"
}
```
**Expected:** Blue section showing "Ready for Booking" with "2024-01-21 3:00 PM"

## Key Changes Made

1. **Conditional Button Display**: "Verify in Ascend" button only shows for HTTP links
2. **Appointment Info Display**: Shows appointment date/time for booking_appointment status
3. **Enhanced Debug Info**: Better debugging information in development mode
4. **Visual Distinction**: Different colors and icons for different statuses

## Benefits

- **Clear Visual Distinction**: Users can immediately see if it's a verification link or appointment info
- **Contextual Actions**: Only shows clickable buttons when appropriate
- **Better Information Display**: Appointment details are clearly visible
- **Improved Debugging**: Development mode shows exactly what type of link is stored
