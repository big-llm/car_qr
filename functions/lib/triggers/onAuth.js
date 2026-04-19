"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.onUserDelete = exports.onUserSignup = void 0;
const functions = __importStar(require("firebase-functions"));
const firebase_1 = require("../config/firebase");
exports.onUserSignup = functions.auth.user().onCreate(async (user) => {
    // If no phone number the user might be created manually or via email, but standard is phone.
    const phoneNumber = user.phoneNumber || "Unknown";
    try {
        const userData = {
            phoneNumber,
            name: user.displayName || "",
            status: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        // Create the Firestore document linked to their Auth UID
        await firebase_1.db.collection("users").doc(user.uid).set(userData);
        console.log(`Successfully created user config for ${user.uid}`);
    }
    catch (error) {
        console.error("Error creating user document setup:", error);
    }
});
exports.onUserDelete = functions.auth.user().onDelete(async (user) => {
    try {
        // Optionally remove user data or mark them as disabled instead of full delete
        await firebase_1.db.collection("users").doc(user.uid).update({ status: "deactivated", updatedAt: new Date().toISOString() });
        console.log(`Successfully deactivated user config for ${user.uid}`);
    }
    catch (error) {
        console.error("Error updating user document on deletion:", error);
    }
});
//# sourceMappingURL=onAuth.js.map