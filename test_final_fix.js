// Test Final Authentication Fix
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3000';
const TENANT_ID = '00000000-0000-4000-8000-000000000001';

async function testFinalFix() {
    console.log('🔧 TESTING FINAL AUTHENTICATION FIX');
    console.log('===================================');

    // Create a new user with the updated code
    const userData = {
        email: 'final.test@stokcerdas.com',
        password: 'FinalTest123!@#',
        firstName: 'Final',
        lastName: 'Test'
    };

    try {
        console.log('\n📝 Step 1: Registering new user...');
        const registerResponse = await fetch(`${BASE_URL}/api/v1/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-tenant-id': TENANT_ID
            },
            body: JSON.stringify(userData)
        });

        const registerResult = await registerResponse.json();
        console.log('Registration result:', registerResult.success ? '✅ SUCCESS' : '❌ FAILED');

        if (registerResult.success) {
            console.log('\n🔐 Step 2: Testing login...');
            const loginResponse = await fetch(`${BASE_URL}/api/v1/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-tenant-id': TENANT_ID
                },
                body: JSON.stringify({
                    email: userData.email,
                    password: userData.password
                })
            });

            const loginResult = await loginResponse.json();
            
            if (loginResult.success) {
                console.log('✅ Login successful!');
                const token = loginResult.data.accessToken;
                
                console.log('\n🧪 Step 3: Testing protected endpoint...');
                const profileResponse = await fetch(`${BASE_URL}/api/v1/auth/profile`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'x-tenant-id': TENANT_ID,
                        'Content-Type': 'application/json'
                    }
                });

                const profileResult = await profileResponse.json();
                
                if (profileResult.success) {
                    console.log('🎉 COMPLETE SUCCESS!');
                    console.log('✅ Registration working');
                    console.log('✅ Login working'); 
                    console.log('✅ JWT token working');
                    console.log('✅ Protected endpoints accessible');
                    console.log('\n👤 User Profile:');
                    console.log('   📧 Email:', profileResult.data.email);
                    console.log('   👤 Name:', profileResult.data.firstName, profileResult.data.lastName);
                    console.log('   🎭 Role:', profileResult.data.role);
                    console.log('   📊 Status:', profileResult.data.status);
                    console.log('   ✉️  Email Verified:', profileResult.data.emailVerified);
                    
                    // Save working credentials
                    require('fs').writeFileSync('final_working_credentials.json', JSON.stringify({
                        email: userData.email,
                        password: userData.password,
                        accessToken: loginResult.data.accessToken,
                        refreshToken: loginResult.data.refreshToken,
                        user: loginResult.data.user
                    }, null, 2));
                    
                    console.log('\n💾 Final credentials saved to: final_working_credentials.json');
                    
                    return true;
                } else {
                    console.log('❌ Protected endpoint failed:', profileResult.error?.message);
                }
            } else {
                console.log('❌ Login failed:', loginResult.error?.message);
            }
        }
    } catch (error) {
        console.log('❌ Error:', error.message);
    }

    return false;
}

testFinalFix()
    .then(success => {
        if (success) {
            console.log('\n🚀 AUTHENTICATION SYSTEM FULLY FIXED!');
            console.log('🎯 Ready for comprehensive testing of all 739 endpoints!');
        } else {
            console.log('\n❌ Fix not complete, needs further investigation');
        }
    })
    .catch(console.error);