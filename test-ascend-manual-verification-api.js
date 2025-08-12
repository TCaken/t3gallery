// Test script for Ascend Manual Verification API
// Usage: node test-ascend-manual-verification-api.js

const https = require('https');

// Configuration
const config = {
  hostname: 'localhost', // Change to your domain in production
  port: 3000, // Change to your port
  path: '/api/ascend/leads/manualverify',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': process.env.ASCEND_API_KEY || 'your-test-api-key-here'
  }
};

// Test data
const testData = {
  customerName: 'John Test Customer',
  phoneNumber: '+6591234567',
  customerHyperLink: 'https://ascend.example.com/customer/test-12345',
  app: 'test-script'
};

console.log('🚀 Testing Ascend Manual Verification API...');
console.log('📋 Test Data:', JSON.stringify(testData, null, 2));
console.log('🔑 API Key:', config.headers['x-api-key']?.substring(0, 8) + '...');

// Create the request
const req = https.request(config, (res) => {
  console.log(`📊 Status Code: ${res.statusCode}`);
  console.log(`📋 Headers:`, res.headers);

  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('📨 Response:', JSON.stringify(response, null, 2));
      
      if (response.success) {
        console.log('✅ Test PASSED: Manual verification stored successfully');
        console.log(`📝 Verification ID: ${response.data?.id}`);
      } else {
        console.log('❌ Test FAILED: API returned error');
        console.log(`🚨 Error: ${response.error}`);
      }
    } catch (error) {
      console.log('❌ Test FAILED: Invalid JSON response');
      console.log('📄 Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
  
  if (error.code === 'ECONNREFUSED') {
    console.log('💡 Make sure your server is running on the correct port');
  }
});

// Send the request
req.write(JSON.stringify(testData));
req.end();

console.log('⏳ Request sent, waiting for response...');
