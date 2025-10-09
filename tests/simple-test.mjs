// simple-test.js
import assert from 'assert/strict';

// The base URL of your running server
const BASE_URL = 'http://localhost:3000';

// A simple state object to hold data between tests, like the JWT
const testState = {};

/**
 * A helper function to run a test case and print the result.
 * @param {string} description - The name of the test.
 * @param {Function} fn - The async function containing the test logic.
 */
async function test(description, fn) {
  try {
    await fn();
    console.log(`\x1b[32m✔ PASS:\x1b[0m ${description}`);
  } catch (error) {
    console.error(`\x1b[31m✖ FAIL:\x1b[0m ${description}`);
    console.error(error);
    // Exit the process on the first failure to prevent cascading errors
    process.exit(1);
  }
}

// Main function to run all our tests in order
(async () => {
  console.log('--- Starting API Tests ---');
  
  const uniqueEmail = `testuser_${Date.now()}@example.com`;
  
  await test('Register a new user', async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: uniqueEmail,
        password: 'Str0ng-P@ssw0rd!',
      }),
    });
    
    const data = await res.json();
    
    assert.strictEqual(res.status, 201, 'Status code should be 201 Created');
    assert.ok(data.token, 'Response should contain a token');
    assert.strictEqual(data.user.email, uniqueEmail, 'Response should contain the new user email');
    
    // Save the token and user ID for the next tests
    testState.token = data.token;
    testState.userId = data.user.id;
  });

  await test('Fail to register the same user again', async () => {
    const res = await fetch(`${BASE_URL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test User',
        email: uniqueEmail,
        password: 'Str0ng-P@ssw0rd!',
      }),
    });
    
    assert.strictEqual(res.status, 409, 'Status code should be 409 Conflict for duplicate email');
  });

  await test('Log in as the new user', async () => {
    const res = await fetch(`${BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'Str0ng-P@ssw0rd!',
      }),
    });
    
    const data = await res.json();
    
    assert.strictEqual(res.status, 200, 'Status code should be 200 OK');
    assert.ok(data.token, 'Login response should contain a token');
  });

  await test('Fetch the user profile with a valid token', async () => {
    const res = await fetch(`${BASE_URL}/api/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${testState.token}`,
      },
    });
    
    const data = await res.json();
    
    assert.strictEqual(res.status, 200, 'Status code should be 200 OK');
    assert.strictEqual(data.user.id, testState.userId, 'Profile data should match the logged-in user');
    assert.strictEqual(data.user.password, undefined, 'Profile data should not contain the password hash');
  });

  console.log('\n--- All Tests Passed Successfully! ---');

})();