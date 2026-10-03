import { mintToken, clerk } from './_prodtest_lib.mjs';

const id = process.argv[2];
const tok = await mintToken(id);
const claims = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString());
console.log(Object.fromEntries(Object.entries(claims).filter(([k]) => !['sub', 'sid', 'azp', 'jti', 'iss'].includes(k))));
console.log('claim keys', Object.keys(claims).join(','));
if (process.argv[3] === 'cleanup') console.log('cleanup', (await clerk('DELETE', `/users/${id}`)).status);
