"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVehicleQRToken = void 0;
const uuid_1 = require("uuid");
/**
 * QR token generator.
 * Used to construct frontend URLs: e.g. https://qr.domain.com/scan/:token
 */
const generateVehicleQRToken = () => {
    return (0, uuid_1.v4)();
};
exports.generateVehicleQRToken = generateVehicleQRToken;
//# sourceMappingURL=qrService.js.map