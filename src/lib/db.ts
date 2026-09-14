import pg from 'pg';
let pool:pg.Pool|undefined;
export function database(){
  if(!process.env.DATABASE_URL) throw new Error('DATABASE_URL não configurada.');
  return pool ??= new pg.Pool({connectionString:process.env.DATABASE_URL,max:10,connectionTimeoutMillis:5000,idleTimeoutMillis:30000});
}
export const EVENT_SLUG='anna-sophie-xv';
