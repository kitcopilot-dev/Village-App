#!/usr/bin/env node
/**
 * Script to add the 'active_days' field to the 'courses' collection in PocketBase
 * Usage: node scripts/add_active_days_field.js <admin_email> <admin_password>
 */

const PB_URL = 'https://bear-nan.exe.xyz';

async function main() {
  const [,, adminEmail, adminPassword] = process.argv;
  
  if (!adminEmail || !adminPassword) {
    console.error('Usage: node add_active_days_field.js <admin_email> <admin_password>');
    process.exit(1);
  }

  try {
    console.log('🔐 Authenticating as admin...');
    
    // Authenticate as admin
    const authResponse = await fetch(`${PB_URL}/api/admins/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identity: adminEmail,
        password: adminPassword
      })
    });

    if (!authResponse.ok) {
      const error = await authResponse.text();
      throw new Error(`Auth failed: ${error}`);
    }

    const authData = await authResponse.json();
    const adminToken = authData.token;
    console.log('✅ Authenticated successfully!');

    // Get current courses collection
    console.log('\n📋 Fetching courses collection schema...');
    const getResponse = await fetch(`${PB_URL}/api/collections/courses`, {
      headers: { 'Authorization': adminToken }
    });

    if (!getResponse.ok) {
      const error = await getResponse.text();
      throw new Error(`Failed to fetch collection: ${error}`);
    }

    const collection = await getResponse.json();
    console.log('✅ Current schema fetched!');
    console.log(`   Fields: ${collection.fields.map(f => f.name).join(', ')}`);

    // Check if active_days already exists
    const hasActiveDays = collection.fields.some(f => f.name === 'active_days');
    
    if (hasActiveDays) {
      console.log('\n⚠️  active_days field already exists!');
      return;
    }

    // Add active_days field
    console.log('\n➕ Adding active_days field...');
    
    collection.fields.push({
      name: 'active_days',
      type: 'text',
      required: false,
      presentable: false,
      unique: false,
      max: 50,
      min: 0,
      pattern: '',
      autogeneratePattern: '',
      hidden: false,
      system: false,
      primaryKey: false
    });

    // Update collection
    const updateResponse = await fetch(`${PB_URL}/api/collections/${collection.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': adminToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(collection)
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      throw new Error(`Failed to update collection: ${error}`);
    }

    const updatedCollection = await updateResponse.json();
    console.log('✅ Field added successfully!');
    console.log(`   Updated fields: ${updatedCollection.fields.map(f => f.name).join(', ')}`);
    console.log('\n🎉 Done! The courses collection now has an active_days field.');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
