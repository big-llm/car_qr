const admin = require("firebase-admin");
const { v4: uuidv4 } = require("uuid");

// Use your live credentials if running directly against your project
// If testing locally using emulators, this will use emulator defaults automatically.
// IMPORTANT: To run this against live db, ensure GOOGLE_APPLICATION_CREDENTIALS points to a service account json.
// Run this via: npx ts-node seed.ts

admin.initializeApp();
const db = admin.firestore();

async function seedTestData() {
  console.log("🌱 Starting Database Seed Process...");

  try {
    // 1. Create a Fake User
    const userId = "test-user-sid-" + Date.now();
    const userData = {
      phoneNumber: "+12345678900",
      name: "John Doe (Test)",
      status: "active",
      createdAt: new Date().toISOString()
    };
    
    await db.collection("users").doc(userId).set(userData);
    console.log(`👤 Created Test User: ${userData.name}`);

    // 2. Create a Fake Vehicle for this user
    const qrToken = uuidv4();
    const vehicleData = {
      userId: userId,
      licensePlate: "TEST-1234",
      make: "Toyota",
      model: "Camry",
      qrToken: qrToken,
      status: "active",
      createdAt: new Date().toISOString()
    };
    
    await db.collection("vehicles").add(vehicleData);
    console.log(`🚗 Created Test Vehicle: ${vehicleData.licensePlate}`);
    console.log(`\n=================================================`);
    console.log(`✅ SUCCESS! Your Backend is Populated!`);
    console.log(`=================================================`);
    console.log(`YOUR TESTING QR TOKEN IS:`);
    console.log(qrToken);
    console.log(`\nTo test your scanner UI, go to:`);
    console.log(`http://localhost:5000/?token=${qrToken}`);
    console.log(`=================================================\n`);
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  }
}

seedTestData();
