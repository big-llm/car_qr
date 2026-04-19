import express from "express";
import path from "path";
import fs from "fs";
import { adminApp } from "./controllers/admin/adminApp";
import { publicApp } from "./controllers/public/publicApp";
import { userApp } from "./controllers/user/userApp";
import dotenv from "dotenv";

// Load environment variables from the root directory
dotenv.config({ path: path.join(__dirname, "../../.env") });

// Required to initialize firebase config globally
import "./config/firebase";

const app = express();
const PORT = process.env.PORT || 5000;

// Mount API Endpoints correctly to prevent middleware leakage!
app.use('/api/admin', adminApp);
app.use('/api/scanner', publicApp);
app.use('/api/user', userApp);

// Serve Frontend Vite App
// Mounts the 'dist' directory created by Vite
let frontendBuildPath = path.join(__dirname, "../../scanner-app/dist");

// Cloud check: If the directory above doesn't exist, try local relative (for Vercel deployment structure)
if (!fs.existsSync(frontendBuildPath)) {
  frontendBuildPath = path.join(process.cwd(), "scanner-app/dist");
}

app.use(express.static(frontendBuildPath));

// Catch-all to serve index.html for React/Vite routing or general requests
app.get("*", (req, res) => {
  res.sendFile(path.join(frontendBuildPath, "index.html"));
});

// Start the unified Express server if running standalone
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running natively on http://localhost:${PORT}`);
  });
}

export default app;
