# Ascend Manual Verification API Documentation

## Overview
This API endpoint allows external systems (specifically Ascend) to store manual verification data for leads. The verification data includes customer information and hyperlinks that are stored securely in the database for record-keeping purposes.

## Endpoint Details

### Manual Verification Storage
**Endpoint:** `POST /api/ascend/leads/manualverify`

**Description:** Stores manual verification data for a customer including their name, phone number, and hyperlink.

**Authentication:** Requires `ASCEND_API_KEY` in headers

## Request Format

### Headers
```
Content-Type: application/json
x-api-key: YOUR_ASCEND_API_KEY
```
*Note: You can also use `apikey` header instead of `x-api-key`*

### Request Body
```json
{
  "customerName": "John Doe",
  "phoneNumber": "+6591234567",
  "customerHyperLink": "https://ascend.example.com/customer/12345",
  "app": "ascend-portal"
}
```

### Required Fields
- `customerName` (string): Full name of the customer
- `phoneNumber` (string): Customer's phone number
- `customerHyperLink` (string): URL/hyperlink related to the customer

### Optional Fields
- `app` (string): Source application name (defaults to "ascend-manual-verify" if not provided)

## Response Format

### Success Response (200)
```json
{
  "success": true,
  "message": "Manual verification stored successfully for John Doe",
  "data": {
    "id": 123,
    "customerName": "John Doe",
    "phoneNumber": "+6591234567",
    "customerHyperLink": "https://ascend.example.com/customer/12345",
    "app": "ascend-portal",
    "createdAt": "2024-01-15T10:30:00.000Z"
  }
}
```

### Error Responses

#### 401 - Unauthorized (Missing API Key)
```json
{
  "success": false,
  "error": "API key required. Please provide x-api-key or apikey header."
}
```

#### 403 - Forbidden (Invalid API Key)
```json
{
  "success": false,
  "error": "Invalid API key provided."
}
```

#### 400 - Bad Request (Missing Required Fields)
```json
{
  "success": false,
  "error": "Missing required fields: customerName, phoneNumber, customerHyperLink"
}
```

#### 400 - Bad Request (Invalid Field Types)
```json
{
  "success": false,
  "error": "All required fields must be strings"
}
```

#### 500 - Internal Server Error
```json
{
  "success": false,
  "error": "Error message describing the issue"
}
```

## Usage Examples

### cURL Example
```bash
curl -X POST https://your-domain.com/api/ascend/leads/manualverify \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ASCEND_API_KEY" \
  -d '{
    "customerName": "Jane Smith",
    "phoneNumber": "+6587654321",
    "customerHyperLink": "https://ascend.example.com/verification/67890",
    "app": "ascend-verification-portal"
  }'
```

### JavaScript/Node.js Example
```javascript
const response = await fetch('https://your-domain.com/api/ascend/leads/manualverify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'YOUR_ASCEND_API_KEY'
  },
  body: JSON.stringify({
    customerName: 'Jane Smith',
    phoneNumber: '+6587654321',
    customerHyperLink: 'https://ascend.example.com/verification/67890',
    app: 'ascend-verification-portal'
  })
});

const result = await response.json();
console.log(result);
```

### Python Example
```python
import requests
import json

url = "https://your-domain.com/api/ascend/leads/manualverify"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "YOUR_ASCEND_API_KEY"
}
data = {
    "customerName": "Jane Smith",
    "phoneNumber": "+6587654321",
    "customerHyperLink": "https://ascend.example.com/verification/67890",
    "app": "ascend-verification-portal"
}

response = requests.post(url, headers=headers, data=json.dumps(data))
result = response.json()
print(result)
```

## Data Storage

### Database Table: `manual_verification_log`
The verification data is stored in the `manual_verification_log` table with the following structure:

| Field | Type | Description |
|-------|------|-------------|
| id | integer | Auto-generated primary key |
| customer_name | varchar(255) | Customer's full name |
| phone_number | varchar(20) | Customer's phone number |
| customer_hyperlink | text | The hyperlink provided |
| app | varchar(100) | Source application name |
| status | varchar(50) | Verification status (default: 'verified') |
| created_at | timestamp | When the record was created |
| created_by | varchar(256) | User ID (if available) |

### Data Retention
- All verification records are retained indefinitely for audit purposes
- Records include timestamps for tracking when verification was performed
- The system maintains logs of all API calls for monitoring and debugging

## Security Notes

1. **API Key Protection**: Keep your API key secure and never expose it in client-side code
2. **HTTPS Required**: All API calls must be made over HTTPS in production
3. **Rate Limiting**: Consider implementing rate limiting on your end to prevent abuse
4. **Data Privacy**: Customer data is handled according to data protection regulations

## Error Handling Best Practices

1. Always check the `success` field in the response
2. Handle different HTTP status codes appropriately
3. Log errors for debugging but avoid exposing sensitive information
4. Implement retry logic for transient failures (5xx errors)
5. Validate input data before making API calls

## Support

For technical support or questions about this API:
- Review the error messages in the response for specific issues
- Check server logs for detailed error information
- Ensure API key is correctly configured
- Verify all required fields are provided with correct data types

## Related APIs

- [Ascend Appointment Reminder API](./API_DOCUMENTATION_ASCEND_APPOINTMENT_REMINDER.md) - For sending appointment reminders
- [API Key Generation Guide](./API_KEY_GENERATION.md) - For managing API keys
