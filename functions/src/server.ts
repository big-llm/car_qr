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
const possiblePaths = [
  path.join(__dirname, "../dist"),           // local dev with ts-node in backend/src
  path.join(process.cwd(), "dist"),          // local dev running from backend/
  path.join(process.cwd(), "backend/dist"),   // local dev running from root
  path.join(__dirname, "dist"),              // production build (post-compile)
];

let frontendBuildPath = possiblePaths.find(p => fs.existsSync(path.join(p, "index.html"))) || possiblePaths[0];

console.log(`📂 Serving frontend from: ${frontendBuildPath}`);

app.use(express.static(frontendBuildPath));

// Catch-all to serve index.html for React/Vite routing or general requests
app.get("*", (req, res) => {
  const indexPath = path.join(frontendBuildPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("Application Shell Not Found");
  }
});

// Start the unified Express server if running standalone
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Server is running natively on http://localhost:${PORT}`);
  });
}

export default app;
