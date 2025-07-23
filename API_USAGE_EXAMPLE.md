# API Usage Examples for Updated Appointment Functions

## Authentication Pattern

All appointment functions now support both Clerk authentication and API key authentication:

```typescript
// Option 1: Clerk Authentication (existing usage)
await createAppointment({
  leadId: 123,
  timeslotId: 456,
  notes: "Initial consultation",
  isUrgent: false
});

// Option 2: API Key Authentication (new usage)
await createAppointment({
  leadId: 123,
  timeslotId: 456,
  notes: "Initial consultation", 
  isUrgent: false,
  overrideUserId: "api_user_id"
});
```

## API Endpoint Examples

### 1. Create Appointment API
```typescript
// /api/appointments/create/route.ts
export async function POST(request: Request) {
  const apiKey = request.headers.get('x-api-key');
  const overrideUserId = validateApiKey(apiKey); // Your validation logic
  
  const body = await request.json();
  
  const result = await createAppointment({
    leadId: body.leadId,
    timeslotId: body.timeslotId,
    notes: body.notes,
    isUrgent: body.isUrgent,
    overrideUserId // Pass the validated user ID
  });
  
  return Response.json(result);
}
```

### 2. Cancel Appointment API
```typescript
// /api/appointments/[id]/cancel/route.ts
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const apiKey = request.headers.get('x-api-key');
  const overrideUserId = validateApiKey(apiKey);
  
  const result = await cancelAppointment(
    parseInt(params.id),
    overrideUserId
  );
  
  return Response.json(result);
}
```

### 3. Update Appointment Status API
```typescript
// /api/appointments/[id]/status/route.ts
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const apiKey = request.headers.get('x-api-key');
  const overrideUserId = validateApiKey(apiKey);
  
  const { status } = await request.json();
  
  const result = await updateAppointmentStatus(
    parseInt(params.id),
    status,
    overrideUserId
  );
  
  return Response.json(result);
}
```

### 4. Get Available Timeslots API
```typescript
// /api/timeslots/[date]/route.ts
export async function GET(request: Request, { params }: { params: { date: string } }) {
  const apiKey = request.headers.get('x-api-key');
  const overrideUserId = validateApiKey(apiKey);
  
  const timeslots = await fetchAvailableTimeslots(
    params.date,
    overrideUserId
  );
  
  return Response.json({ timeslots });
}
```

## Updated Function Signatures

```typescript
// All functions now support optional overrideUserId parameter

// Core appointment management
checkExistingAppointment(leadId: number, overrideUserId?: string)
createAppointment(data: CreateAppointmentData, overrideUserId?: string)  
cancelAppointment(appointmentId: number, overrideUserId?: string)
updateAppointmentStatus(appointmentId: number, newStatus: string, overrideUserId?: string)
moveAppointmentToTimeslot(appointmentId: number, newTimeslotId: number, overrideUserId?: string)

// Utility functions
fetchAvailableTimeslots(date: string, overrideUserId?: string)
generateTimeslots(data: GenerateTimeslotsData, overrideUserId?: string)
createCalendarSettings(data: CalendarSettingsData, overrideUserId?: string)
```

## API Key Validation Example

```typescript
function validateApiKey(apiKey: string | null): string {
  if (!apiKey) {
    throw new Error('API key required');
  }
  
  // Validate against your API key store
  const validApiKey = process.env.APPOINTMENT_API_KEY;
  if (apiKey !== validApiKey) {
    throw new Error('Invalid API key');
  }
  
  // Return a system user ID for tracking
  return 'system_api_user';
}
```

## Benefits

1. **Backwards Compatibility**: Existing Clerk-based calls continue to work
2. **API Integration**: New API endpoints can use system authentication
3. **Audit Trail**: All operations still track `created_by`/`updated_by` properly
4. **Consistent Pattern**: Same authentication pattern across all functions 