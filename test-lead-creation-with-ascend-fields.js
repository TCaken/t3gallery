// Test script to verify that leads are created with ascend_status and airconnect_verification_link
// This tests the updated CreateLeadInput interface

const API_BASE_URL = 'http://localhost:3000';
const API_KEY = 'YOUR_ASCEND_API_KEY'; // Replace with your actual API key

async function testLeadCreationWithAscendFields() {
  console.log('🧪 Testing Lead Creation with Ascend Fields\n');

  // Test Case: New Lead with Ascend Fields
  console.log('📝 Test Case: New Lead with Ascend Status and Verification Link');
  try {
    const response = await fetch(`${API_BASE_URL}/api/ascend/leads/manualverify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify({
        customerName: "Test Customer",
        phoneNumber: "+6591234567",
        customerHyperLink: "https://ascend.example.com/customer/test123",
        app: "test-ascend-fields"
      })
    });

    const result = await response.json();
    console.log('✅ Lead Creation Result:', JSON.stringify(result, null, 2));
    
    if (result.success && result.data?.leadProcessing) {
      console.log('\n📊 Lead Processing Details:');
      console.log('- Lead Type:', result.data.leadProcessing.leadType);
      console.log('- Ascend Status:', result.data.leadProcessing.ascendStatus);
      console.log('- AirConnect Link:', result.data.leadProcessing.airconnectLink);
      console.log('- Lead ID:', result.data.leadProcessing.leadId);
    }

  } catch (error) {
    console.error('❌ Lead Creation Error:', error.message);
  }

  console.log('\n🎉 Testing completed!');
  console.log('\n📋 Expected Results:');
  console.log('- New lead should be created with lead_type: "new"');
  console.log('- ascend_status should be set to "manual_verification_required"');
  console.log('- airconnect_verification_link should contain the provided hyperlink');
  console.log('- Manual verification log should be stored with request body');
}

// Run the test
testLeadCreationWithAscendFields().catch(console.error);
