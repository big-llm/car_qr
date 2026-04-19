async function runTests() {
  console.log("Starting API Endpoint Tests...");
  let adminToken = "";
  let testUserId = "";
  let testToken = "";

  try {
    // TEST 1: LOGIN (Admin)
    console.log("➡️ TEST 1: Admin Login...");
    const loginRes = await fetch("http://localhost:5000/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userid: "admin", password: "password123" })
    });
    const loginData = await loginRes.json();
    if (!loginRes.ok) throw new Error(loginData.error || "Login failed");
    adminToken = loginData.token;
    console.log("✅ Login Success! Token:", adminToken);

    // TEST 2: CREATE USER
    // Wait, creating user on live Firebase uses auth.createUser() which will fail without google credentials!
    // But let's see what happens.
    console.log("➡️ TEST 2: Create User...");
    const randomPhone = `+1555${Math.floor(1000000 + Math.random() * 9000000)}`;
    const userRes = await fetch("http://localhost:5000/api/admin/users", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({ phoneNumber: randomPhone, name: "API Test User" })
    });
    const userData = await userRes.json();
    if (!userRes.ok) throw new Error(userData.error || "User Creation failed");
    testUserId = userData.id;
    console.log("✅ User Created! ID:", testUserId);

    // TEST 3: CREATE VEHICLE
    console.log("➡️ TEST 3: Create Vehicle...");
    const vehicleRes = await fetch("http://localhost:5000/api/admin/vehicles", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${adminToken}`
      },
      body: JSON.stringify({ userId: testUserId, licensePlate: "TEST-" + Math.floor(Math.random()*999), make: "Ford" })
    });
    const vehicleData = await vehicleRes.json();
    if (!vehicleRes.ok) throw new Error(vehicleData.error || "Vehicle Creation failed");
    testToken = vehicleData.qrToken;
    console.log("✅ Vehicle Created! QR Token:", testToken);

    // TEST 4: PUBLIC - GET VEHICLE BY TOKEN
    console.log("➡️ TEST 4: Fetch Vehicle (Public API)...");
    const pubGetRes = await fetch(`http://localhost:5000/api/scanner/qr/${testToken}`);
    const pubGetData = await pubGetRes.json();
    if (!pubGetRes.ok) throw new Error(pubGetData.error || "Fetch Vehicle failed");
    console.log("✅ Public Fetch Success!", pubGetData.vehicle);

    // TEST 5: PUBLIC - SEND ALERT (Bypassed Flow)
    console.log("➡️ TEST 5: Submit Alert (Public API)...");
    const alertRes = await fetch(`http://localhost:5000/api/scanner/qr/${testToken}/alert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "blocking_vehicle", senderPhone: "+1234567890" })
    });
    const alertData = await alertRes.json();
    
    // We expect 201 Created or an error
    console.log("Alert Response:", alertRes.status, alertData);

  } catch (err) {
    console.error("❌ Test Failed:", err);
  }
}

runTests();
