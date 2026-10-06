
const http = require('http');
const fs = require('fs');
const path = require('path');

const BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';
const parsedUrl = new URL(BASE_URL);

function makeRequest(method, endpoint, payload = null) {
  return new Promise((resolve, reject) => {
    let postData = '';
    if (method !== 'GET' && payload) {
      postData = JSON.stringify(payload);
    }

    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || 80,
      path: endpoint,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    };

    if (postData) {
      options.headers['Content-Length'] = Buffer.byteLength(postData);
    }

    const req = http.request(options, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = body ? JSON.parse(body) : null;
        } catch (e) {
          parsed = { _raw: body, parseError: e.message };
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: parsed
        });
      });
    });

    req.on('error', (err) => reject(err));

    if (postData) req.write(postData);
    req.end();
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message || 'Value mismatch'}: expected "${expected}", got "${actual}"`);
  }
}

async function runTestSuite() {
  console.log(`Starting Stateful Order API Automated Test Suite against ${BASE_URL}...\n`);
  const tests = [];
  const startTime = Date.now();

  let aliceToken = null;
  let bobToken = null;
  let aliceOrderId1 = null;
  let aliceOrderId2 = null;
  let bobOrderId1 = null;

  async function executeTest(id, name, type, fn) {
    const testStart = Date.now();
    const testRecord = {
      id,
      name,
      type,
      status: 'pending',
      expected: '',
      actual: '',
      durationMs: 0,
      reason: null
    };

    try {
      await fn(testRecord);
      testRecord.status = 'passed';
      testRecord.reason = testRecord.reason || 'All assertions passed successfully.';
      console.log(`  [PASS] ${id} - ${name} (${Date.now() - testStart}ms)`);
    } catch (err) {
      testRecord.status = 'failed';
      testRecord.reason = err.message;
      console.log(`  [FAIL] ${id} - ${name} (${Date.now() - testStart}ms) -> ${err.message}`);
    }

    testRecord.durationMs = Date.now() - testStart;
    tests.push(testRecord);
  }


  await executeTest('TC-AUTH-01', 'Valid Login: Alice', 'positive', async (t) => {
    t.expected = 'HTTP 200, { token: "alice" }';
    const res = await makeRequest('POST', '/api/login', { username: 'alice' });
    t.actual = `HTTP ${res.statusCode}, ${JSON.stringify(res.body)}`;
    assertEqual(res.statusCode, 200, 'Status code must be 200');
    assert(res.body && res.body.token === 'alice', 'Response body must contain token = "alice"');
    aliceToken = res.body.token;
  });

  await executeTest('TC-AUTH-02', 'Valid Login: Bob', 'positive', async (t) => {
    t.expected = 'HTTP 200, { token: "bob" }';
    const res = await makeRequest('POST', '/api/login', { username: 'bob' });
    t.actual = `HTTP ${res.statusCode}, ${JSON.stringify(res.body)}`;
    assertEqual(res.statusCode, 200, 'Status code must be 200');
    assert(res.body && res.body.token === 'bob', 'Response body must contain token = "bob"');
    bobToken = res.body.token;
  });


  await executeTest('TC-ORD-01', 'Valid Order Creation: Alice spends 30 credits', 'positive', async (t) => {
    t.expected = 'HTTP 201, { orderId: string, newCredit: 70 }';
    const res = await makeRequest('POST', '/api/order', { token: aliceToken || 'alice', item: 'book', amount: 30 });
    t.actual = `HTTP ${res.statusCode}, ${JSON.stringify(res.body)}`;
    assertEqual(res.statusCode, 201, 'Status code must be 201 Created');
    assert(res.body && typeof res.body.orderId === 'string' && res.body.orderId.length > 0, 'orderId must be non-empty string');
    assertEqual(res.body.newCredit, 70, 'Alice credit should decrement from 100 to 70');
    aliceOrderId1 = res.body.orderId;
  });

  await executeTest('TC-ORD-02', 'Boundary Order: Alice spends exact remaining credit (70)', 'boundary', async (t) => {
    t.expected = 'HTTP 201, { orderId: string, newCredit: 0 }';
    const res = await makeRequest('POST', '/api/order', { token: aliceToken || 'alice', item: 'laptop', amount: 70 });
    t.actual = `HTTP ${res.statusCode}, ${JSON.stringify(res.body)}`;
    assertEqual(res.statusCode, 201, 'Status code must be 201 Created');
    assertEqual(res.body.newCredit, 0, 'Alice credit should become exactly 0');
    aliceOrderId2 = res.body.orderId;
  });



  await executeTest('TC-LST-01', 'Get Orders Contract Validation: Alice Orders', 'contract_bug', async (t) => {
    t.expected = 'HTTP 200, { orders: [ { orderId, item, amount, status: "pending" } ] }';
    const res = await makeRequest('GET', '/api/orders?token=alice');
    t.actual = `HTTP ${res.statusCode}, ${JSON.stringify(res.body)}`;
    assertEqual(res.statusCode, 200, 'Status code should be 200 according to contract');
    assert(res.body && Array.isArray(res.body.orders), 'Response body must have orders array');
    assertEqual(res.body.orders.length, 2, 'Alice should have 2 orders');
  });

  await executeTest('TC-LST-02', 'Get Orders Invalid Token Validation', 'negative', async (t) => {
    t.expected = 'HTTP 401, { error: "Invalid token" }';
    const res = await makeRequest('GET', '/api/orders?token=fake_user_xyz');
    t.actual = `HTTP ${res.statusCode}, ${JSON.stringify(res.body)}`;
    assertEqual(res.statusCode, 401, 'Status code must be 401 for invalid token query');
    assertEqual(res.body && res.body.error, 'Invalid token', 'Error message mismatch');
  });


  await executeTest('TC-CNC-01', 'Valid Order Cancel: Alice cancels order 2 (Refund 70)', 'stateful', async (t) => {
    t.expected = `HTTP 200, { orderId: "${aliceOrderId2}", status: "cancelled", newCredit: 70 }`;
    const res = await makeRequest('POST', '/api/order/cancel', { token: aliceToken || 'alice', orderId: aliceOrderId2 });
    t.actual = `HTTP ${res.statusCode}, ${JSON.stringify(res.body)}`;
    assertEqual(res.statusCode, 200, 'Status code must be 200');
    assertEqual(res.body && res.body.status, 'cancelled', 'Status must be cancelled');
    assertEqual(res.body && res.body.newCredit, 70, 'Credit must be refunded back to 70');
  });

  await executeTest('TC-CNC-02', 'Invalid Sequence: Alice cancels already cancelled order', 'stateful', async (t) => {
    t.expected = 'HTTP 409, { error: "Order cannot be cancelled" }';
    const res = await makeRequest('POST', '/api/order/cancel', { token: aliceToken || 'alice', orderId: aliceOrderId2 });
    t.actual = `HTTP ${res.statusCode}, ${JSON.stringify(res.body)}`;
    assertEqual(res.statusCode, 409, 'Status code must be 409 Conflict');
    assertEqual(res.body && res.body.error, 'Order cannot be cancelled', 'Error message mismatch');
  });




  await executeTest('TC-CMP-01', 'Valid Order Complete: Alice completes order 1', 'stateful', async (t) => {
    t.expected = `HTTP 200, { orderId: "${aliceOrderId1}", status: "completed" }`;
    const res = await makeRequest('POST', '/api/order/complete', { token: aliceToken || 'alice', orderId: aliceOrderId1 });
    t.actual = `HTTP ${res.statusCode}, ${JSON.stringify(res.body)}`;
    assertEqual(res.statusCode, 200, 'Status code must be 200');
    assertEqual(res.body && res.body.status, 'completed', 'Status must be completed');
  });

  await executeTest('TC-CMP-02', 'Invalid Sequence: Alice tries to cancel completed order 1', 'stateful', async (t) => {
    t.expected = 'HTTP 409, { error: "Order cannot be cancelled" }';
    const res = await makeRequest('POST', '/api/order/cancel', { token: aliceToken || 'alice', orderId: aliceOrderId1 });
    t.actual = `HTTP ${res.statusCode}, ${JSON.stringify(res.body)}`;
    assertEqual(res.statusCode, 409, 'Status code must be 409 Conflict');
    assertEqual(res.body && res.body.error, 'Order cannot be cancelled', 'Error message mismatch');
  });



  const totalTests = tests.length;
  const passed = tests.filter(t => t.status === 'passed').length;
  const failed = tests.filter(t => t.status === 'failed').length;
  const passRate = `${((passed / totalTests) * 100).toFixed(1)}%`;
  const totalDurationMs = Date.now() - startTime;

  const reportData = {
    reportType: 'Stateful Order API Automated Test Execution Report',
    isSampleStaticReport: false,
    generatedAt: new Date().toISOString(),
    baseUrl: BASE_URL,
    summary: {
      totalTests,
      passed,
      failed,
      passRate,
      totalDurationMs
    },
    tests
  };

  const reportJsonPath = path.join(__dirname, 'api-test-report.json');
  fs.writeFileSync(reportJsonPath, JSON.stringify(reportData, null, 2), 'utf8');
  const markdownPath = path.join(__dirname, '..', 'Report.md');
  const rows = tests.map(test => `| ${test.id} | ${test.name.replace(/\|/g, '\\|')} | ${test.status.toUpperCase()} | ${test.durationMs} |`).join('\n');
  const markdown = `# Stateful Order API — Test Execution Report\n\nGenerated: ${reportData.generatedAt}  \nBase URL: \`${BASE_URL}\`\n\n## Summary\n\n- Total: **${totalTests}**\n- Passed: **${passed}**\n- Failed: **${failed}**\n- Pass rate: **${passRate}**\n\n## Results\n\n| ID | Scenario | Status | Duration (ms) |\n|---|---|---:|---:|\n${rows}\n\n## Failure notes\n\n${tests.filter(test => test.status === 'failed').map(test => `- **${test.id} — ${test.name}:** ${test.reason}`).join('\n') || 'No failures.'}\n\nThe GET /api/orders contract case expects token from the query string. The implementation reads the request header instead, so the contract-conformant request is rejected.\n`;
  fs.writeFileSync(markdownPath, markdown, 'utf8');
  console.log(`\n[OK] JSON Report saved to ${reportJsonPath}`);
  console.log(`[OK] Markdown Report saved to ${markdownPath}`);

  console.log(`TOTAL: ${totalTests} | PASSED: ${passed} | FAILED: ${failed} | RATE: ${passRate}`);
}


module.exports = { runTestSuite };
