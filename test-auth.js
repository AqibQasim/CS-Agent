require('dotenv').config();
const OdooClient = require('./odooClient');

async function testAuth() {
  console.log('Testing Odoo Authentication...\n');
  
  const client = new OdooClient(
    process.env.ODOO_URL,
    process.env.ODOO_DB,
    process.env.ODOO_USERNAME,
    process.env.ODOO_PASSWORD
  );

  try {
    const uid = await client.authenticate();
    console.log('\n✅ SUCCESS! UID:', uid);
    
    // Test a simple query
    console.log('\nTesting API access...');
    const channels = await client.getAllChannels();
    console.log(`✅ Found ${channels.all.length} channels`);
    
  } catch (error) {
    console.error('\n❌ FAILED:', error.message);
  }
}

testAuth();
