"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const adminApp_1 = require("./controllers/admin/adminApp");
const publicApp_1 = require("./controllers/public/publicApp");
const userApp_1 = require("./controllers/user/userApp");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables from the root directory
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../../../.env") });
// Required to initialize firebase config globally
require("./config/firebase");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Mount API Endpoints correctly to prevent middleware leakage!
app.use('/api/admin', adminApp_1.adminApp);
app.use('/api/scanner', publicApp_1.publicApp);
app.use('/api/user', userApp_1.userApp);
// Serve Frontend Vite App
// Mounts the 'dist' directory created by Vite
const frontendBuildPath = path_1.default.join(__dirname, "../../../scanner-app/dist");
app.use(express_1.default.static(frontendBuildPath));
// Catch-all to serve index.html for React/Vite routing or general requests
app.get("*", (req, res) => {
    res.sendFile(path_1.default.join(frontendBuildPath, "index.html"));
});
// Start the unified Express server
app.listen(PORT, () => {
    console.log(`Server is running natively on http://localhost:${PORT}`);
});
//# sourceMappingURL=server.js.map