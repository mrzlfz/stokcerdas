// Debug Authentication Issue
// This script will help us understand what's happening with user registration and login

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const TENANT_ID = '00000000-0000-4000-8000-000000000001';

async function debugAuth() {
    console.log('🔍 DEBUGGING AUTHENTICATION ISSUE');
    console.log('=====================================');

    // Test 1: Register a new user
    console.log('\n📝 Step 1: Registering new user...');
    const registerData = {
        email: 'debug.user@stokcerdas.com',
        password: 'DebugPass123!@#',
        firstName: 'Debug',
        lastName: 'User'
    };

    try {
        const registerResponse = await fetch(`${BASE_URL}/api/v1/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': TENANT_ID
            },
            body: JSON.stringify(registerData)
        });

        const registerResult = await registerResponse.json();
        console.log('📊 Registration Result:');
        console.log(JSON.stringify(registerResult, null, 2));

        if (!registerResult.success) {
            console.log('❌ Registration failed, trying with existing user...');
        }

    } catch (error) {
        console.log('❌ Registration error:', error.message);
    }

    // Test 2: Try to login with the same credentials
    console.log('\n🔐 Step 2: Attempting login...');
    const loginData = {
        email: 'debug.user@stokcerdas.com',
        password: 'DebugPass123!@#'
    };

    try {
        const loginResponse = await fetch(`${BASE_URL}/api/v1/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': TENANT_ID
            },
            body: JSON.stringify(loginData)
        });

        const loginResult = await loginResponse.json();
        console.log('📊 Login Result:');
        console.log(JSON.stringify(loginResult, null, 2));

        if (loginResult.success) {
            console.log('✅ Login successful!');
            console.log('🔑 Access Token:', loginResult.data.accessToken.substring(0, 20) + '...');
        } else {
            console.log('❌ Login failed!');
            console.log('🔍 Error Code:', loginResult.error?.code);
            console.log('🔍 Error Message:', loginResult.error?.message);
        }

    } catch (error) {
        console.log('❌ Login error:', error.message);
    }

    // Test 3: Try with different user credentials (common admin)
    console.log('\n👤 Step 3: Testing with common admin credentials...');
    const adminLogins = [
        { email: 'admin@stokcerdas.com', password: 'admin123' },
        { email: 'admin@stokcerdas.com', password: 'password123' },
        { email: 'admin@stokcerdas.com', password: 'Admin123!' },
        { email: 'test@stokcerdas.com', password: 'test123' },
        { email: 'user@stokcerdas.com', password: 'user123' }
    ];

    for (const creds of adminLogins) {
        try {
            console.log(`\n🧪 Testing: ${creds.email} / ${creds.password}`);
            
            const response = await fetch(`${BASE_URL}/api/v1/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': TENANT_ID
                },
                body: JSON.stringify(creds)
            });

            const result = await response.json();
            
            if (result.success) {
                console.log('✅ SUCCESS! Found working credentials');
                console.log('🔑 Access Token:', result.data.accessToken.substring(0, 20) + '...');
                break;
            } else {
                console.log('❌ Failed:', result.error?.message);
            }

        } catch (error) {
            console.log('❌ Error:', error.message);
        }
    }

    console.log('\n🔍 ANALYSIS COMPLETE');
    console.log('==================');
}

// Run the debug
debugAuth().catch(console.error);