// Test script for the new Ascend Lead Processing flow
// This demonstrates how the API now handles different scenarios

const API_BASE_URL = 'http://localhost:3000';
const API_KEY = 'YOUR_ASCEND_API_KEY'; // Replace with your actual API key

async function testAscendLeadProcessing() {
  console.log('🧪 Testing Ascend Lead Processing Flow\n');

  // Test Case 1: New Lead (not found in any lists)
  console.log('📝 Test Case 1: New Lead');
  try {
    const response1 = await fetch(`${API_BASE_URL}/api/ascend/leads/manualverify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        customerName: "John Doe",
        phoneNumber: "+6591234567",
        customerHyperLink: "https://ascend.example.com/customer/12345",
        app: "test-new-lead"
      })
    });

    const result1 = await response1.json();
    console.log('✅ New Lead Result:', JSON.stringify(result1, null, 2));
  } catch (error) {
    console.error('❌ New Lead Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 2: Reloan Customer (found in ATOM/CAPC lists)
  console.log('📝 Test Case 2: Reloan Customer');
  try {
    const response2 = await fetch(`${API_BASE_URL}/api/ascend/leads/reloan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        customerName: "Jane Smith",
        phoneNumber: "+6598765432",
        customerHyperLink: "https://ascend.example.com/customer/67890",
        app: "test-reloan"
      })
    });

    const result2 = await response2.json();
    console.log('✅ Reloan Customer Result:', JSON.stringify(result2, null, 2));
  } catch (error) {
    console.error('❌ Reloan Customer Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 3: Duplicate Lead (exists in AirConnect)
  console.log('📝 Test Case 3: Duplicate Lead');
  try {
    const response3 = await fetch(`${API_BASE_URL}/api/ascend/leads/manualverify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        customerName: "Bob Johnson",
        phoneNumber: "+6591234567", // Same phone as Test Case 1
        customerHyperLink: "https://ascend.example.com/customer/11111",
        app: "test-duplicate"
      })
    });

    const result3 = await response3.json();
    console.log('✅ Duplicate Lead Result:', JSON.stringify(result3, null, 2));
  } catch (error) {
    console.error('❌ Duplicate Lead Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 4: Appointment Reminder (New Lead)
  console.log('📝 Test Case 4: Appointment Reminder - New Lead');
  try {
    const response4 = await fetch(`${API_BASE_URL}/api/appointments/ascend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        customerName: "Alice Johnson",
        phoneNumber: "+6591111111",
        appointmentDate: "2024-01-20",
        timeSlot: "2:00 PM",
        app: "test-appointment-new"
      })
    });

    const result4 = await response4.json();
    console.log('✅ Appointment Reminder - New Lead Result:', JSON.stringify(result4, null, 2));
  } catch (error) {
    console.error('❌ Appointment Reminder - New Lead Error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test Case 5: Appointment Reminder (Duplicate Lead)
  console.log('📝 Test Case 5: Appointment Reminder - Duplicate Lead');
  try {
    const response5 = await fetch(`${API_BASE_URL}/api/appointments/ascend`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        customerName: "Bob Johnson",
        phoneNumber: "+6591234567", // Same phone as Test Case 1
        appointmentDate: "2024-01-21",
        timeSlot: "3:00 PM",
        app: "test-appointment-duplicate"
      })
    });

    const result5 = await response5.json();
    console.log('✅ Appointment Reminder - Duplicate Lead Result:', JSON.stringify(result5, null, 2));
  } catch (error) {
    console.error('❌ Appointment Reminder - Duplicate Lead Error:', error.message);
  }

  console.log('\n🎉 Testing completed!');
}

// Run the test
testAscendLeadProcessing().catch(console.error);
