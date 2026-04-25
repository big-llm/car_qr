"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const adminApp_1 = require("./controllers/admin/adminApp");
const publicApp_1 = require("./controllers/public/publicApp");
const userApp_1 = require("./controllers/user/userApp");
const dotenv_1 = __importDefault(require("dotenv"));
// Load environment variables from the root directory
dotenv_1.default.config({ path: path_1.default.join(__dirname, "../../.env") });
// Required to initialize firebase config globally
require("./config/firebase");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// Mount API Endpoints correctly to prevent middleware leakage!
app.use('/api/admin', adminApp_1.adminApp);
app.use('/api/scanner', publicApp_1.publicApp);
app.use('/api/user', userApp_1.userApp);
// Serve Frontend Vite App
const possiblePaths = [
    path_1.default.join(__dirname, "../dist"), // local dev with ts-node in backend/src
    path_1.default.join(process.cwd(), "dist"), // local dev running from backend/
    path_1.default.join(process.cwd(), "backend/dist"), // local dev running from root
    path_1.default.join(__dirname, "dist"), // production build (post-compile)
];
let frontendBuildPath = possiblePaths.find(p => fs_1.default.existsSync(path_1.default.join(p, "index.html"))) || possiblePaths[0];
console.log(`📂 Serving frontend from: ${frontendBuildPath}`);
app.use(express_1.default.static(frontendBuildPath));
// Catch-all to serve index.html for React/Vite routing or general requests
app.get("*", (req, res) => {
    const indexPath = path_1.default.join(frontendBuildPath, "index.html");
    if (fs_1.default.existsSync(indexPath)) {
        res.sendFile(indexPath);
    }
    else {
        res.status(404).send("Application Shell Not Found");
    }
});
// Start the unified Express server if running standalone
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`Server is running natively on http://localhost:${PORT}`);
    });
}
exports.default = app;
//# sourceMappingURL=server.js.map