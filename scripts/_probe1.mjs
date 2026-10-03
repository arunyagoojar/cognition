import { createTestUser, mintToken, api, clerk } from './_prodtest_lib.mjs';

const u = await createTestUser();
console.log('user', u.id);
const tok = await mintToken(u.id);
console.log('me', JSON.stringify(await api(tok, 'GET', '/api/me')));
const fake = 'AIzaSy' + 'X'.repeat(33);
console.log('put cred (fake key)', JSON.stringify(await api(tok, 'PUT', '/api/credentials/gemini', { key: fake })));
console.log('status', JSON.stringify(await api(tok, 'GET', '/api/credentials/gemini/status')));
// cleanup via D1 + Clerk
console.log('delete (prod)', JSON.stringify(await api(tok, 'DELETE', '/api/me')));
console.log('clerk lookup', (await clerk('GET', `/users/${u.id}`)).status);
