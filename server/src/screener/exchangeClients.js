import path from 'path';
import { fileURLToPath } from 'url';
import { NSE, BSE } from 'nse-bse-api';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const downloadsDir = path.join(__dirname, '..', '..', 'downloads');

let nseClient = null;
let bseClient = null;

export function getNseClient() {
  if (!nseClient) {
    nseClient = new NSE(downloadsDir, { server: false, timeout: 30000 });
  }
  return nseClient;
}

export function getBseClient() {
  if (!bseClient) {
    bseClient = new BSE(downloadsDir, { server: false, timeout: 30000 });
  }
  return bseClient;
}
