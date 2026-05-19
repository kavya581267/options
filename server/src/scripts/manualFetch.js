import dotenv from 'dotenv';
dotenv.config({ path: new URL('../../.env', import.meta.url).pathname });

process.env.FORCE_FETCH = 'true';

const { collectAll } = await import('../collector.js');

console.log('Manual fetch (FORCE_FETCH=true)...');
const result = await collectAll();
console.log(JSON.stringify(result, null, 2));
