// simple-test.js
import assert from 'assert/strict';

// The base URL of your running server
const BASE_URL = 'http://localhost:3000';

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

  const API = 'http://localhost:3000';

  function randEmail() {
    return `user_${Date.now()}_${Math.floor(Math.random() * 1000)}@example.com`;
  }

  async function tryJsonOrText(res) {
    const txt = await res.text();
    try {
      return JSON.parse(txt);
    } catch {
      return txt;
    }
  }

  // Register
  const registerBody = {
    name: 'Test User',
    email: randEmail(),
    password: 'Password183!',
  };
  const regRes = await fetch(`${API}/api/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(registerBody),
  });

  const regBody = await tryJsonOrText(regRes);

  if (regRes.status !== 201) {
    console.error('✖ FAIL: Register a new user');
    console.error('Status:', regRes.status);
    console.error('Response body:', regBody);
    process.exitCode = 1;
    return;
  }

  console.log('✔ PASS: Register returned 201');
  console.log('Body:', regBody);

  // Optionally run login test using registered creds
  const loginRes = await fetch(`${API}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: registerBody.email,
      password: registerBody.password,
    }),
  });

  const loginBody = await tryJsonOrText(loginRes);
  if (loginRes.status !== 200) {
    console.error('✖ FAIL: Login');
    console.error('Status:', loginRes.status);
    console.error('Response body:', loginBody);
    process.exitCode = 1;
    return;
  }

  console.log('✔ PASS: Login');
  console.log('Body:', loginBody);

  console.log('\n--- All Tests Passed Successfully! ---');
})().catch((err) => {
  console.error('Test runner error:', err);
  process.exit(1);
});