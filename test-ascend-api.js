// Test script for Ascend Appointment Reminder API
// Usage: node test-ascend-api.js

const API_URL = 'http://localhost:3000/api/appointments/ascend'; // Change to your domain
const API_KEY = 'your-api-key-here'; // Replace with your actual API key

async function testAscendAPI() {
  console.log('🧪 Testing Ascend Appointment Reminder API...\n');

  // Test 1: Valid request with API key
  console.log('📞 Test 1: Valid request with API key');
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        customerName: "John Doe",
        phoneNumber: "+6512345678",
        appointmentDate: "2025-01-15",
        timeSlot: "2:00 PM",
        app: "test-script"
      })
    });

    const result = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', result);
    console.log('');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 2: Missing API key
  console.log('🔒 Test 2: Missing API key (should fail)');
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
        // No API key header
      },
      body: JSON.stringify({
        customerName: "Jane Doe",
        phoneNumber: "+6587654321",
        appointmentDate: "2025-01-16",
        timeSlot: "Morning"
      })
    });

    const result = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', result);
    console.log('');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 3: Invalid API key
  console.log('❌ Test 3: Invalid API key (should fail)');
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'invalid-key-123'
      },
      body: JSON.stringify({
        customerName: "Bob Smith",
        phoneNumber: "+6511111111",
        appointmentDate: "2025-01-17",
        timeSlot: "Evening"
      })
    });

    const result = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', result);
    console.log('');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }

  // Test 4: Missing required fields
  console.log('⚠️  Test 4: Missing required fields (should fail)');
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        customerName: "Alice Brown",
        // Missing phoneNumber, appointmentDate, timeSlot
      })
    });

    const result = await response.json();
    console.log(`Status: ${response.status}`);
    console.log('Response:', result);
    console.log('');
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }

  console.log('✅ API testing completed!');
}

// Run the tests
testAscendAPI().catch(console.error);

/*
Expected Results:
- Test 1: Status 200, success: true (if API key and environment are configured)
- Test 2: Status 401, error about missing API key
- Test 3: Status 403, error about invalid API key  
- Test 4: Status 400, error about missing required fields

Setup Instructions:
1. Replace API_KEY with your actual API key
2. Make sure ASCEND_API_KEY environment variable is set on your server
3. Update API_URL to match your deployment URL
4. Run: node test-ascend-api.js
*/ 