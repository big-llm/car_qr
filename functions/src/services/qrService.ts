import { v4 as uuidv4 } from 'uuid';

/**
 * QR token generator.
 * Used to construct frontend URLs: e.g. https://qr.domain.com/scan/:token
 */
export const generateVehicleQRToken = (): string => {
  return uuidv4();
};
