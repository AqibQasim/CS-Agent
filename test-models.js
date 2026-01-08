require('dotenv').config();
const xmlrpc = require('xmlrpc');

const url = process.env.ODOO_URL;
const db = process.env.ODOO_DB;
const username = process.env.ODOO_USERNAME;
const password = process.env.ODOO_PASSWORD;

async function testModels() {
  // Authenticate
  const common = xmlrpc.createSecureClient(`${url}/xmlrpc/2/common`);
  
  common.methodCall('authenticate', [db, username, password, {}], (err, uid) => {
    if (err) {
      console.error('Auth error:', err);
      return;
    }
    
    console.log('✅ Authenticated with UID:', uid);
    
    // Try different model names
    const models = xmlrpc.createSecureClient(`${url}/xmlrpc/2/object`);
    
    const modelNamesToTry = [
      'mail.channel',
      'discuss.channel',
      'im_livechat.channel',
      'mail.thread',
      'res.partner',
      'mail.message'
    ];
    
    modelNamesToTry.forEach((modelName, index) => {
      setTimeout(() => {
        models.methodCall('execute_kw', [
          db, uid, password,
          modelName,
          'search_read',
          [[], []],
          { limit: 1 }
        ], (err, result) => {
          if (err) {
            console.log(`❌ ${modelName} - NOT FOUND`);
          } else {
            console.log(`✅ ${modelName} - EXISTS (${result.length} records found)`);
            if (result.length > 0) {
              console.log('   Sample fields:', Object.keys(result[0]).slice(0, 10).join(', '));
            }
          }
        });
      }, index * 500); // Delay each request
    });
  });
}

testModels();
