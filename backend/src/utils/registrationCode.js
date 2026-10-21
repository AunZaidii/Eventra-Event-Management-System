// Short, readable registration codes like "EVT-7K3Q9P".
// The alphabet skips look-alike characters (0/O, 1/I/L).
const crypto = require('crypto');

const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 6;
const CODE_PATTERN = new RegExp(`^EVT-[${ALPHABET}]{${LENGTH}}$`);

function generateRegistrationCode() {
  let code = '';
  for (let i = 0; i < LENGTH; i += 1) {
    code += ALPHABET[crypto.randomInt(ALPHABET.length)];
  }
  return `EVT-${code}`;
}

module.exports = { generateRegistrationCode, CODE_PATTERN };
