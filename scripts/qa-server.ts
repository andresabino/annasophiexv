// Disposable synthetic fixture, never part of the runtime deployment.
import {PGlite} from '@electric-sql/pglite';import {PGLiteSocketServer} from '@electric-sql/pglite-socket';import {spawn} from 'node:child_process';import {generateToken,hashToken} from '../src/lib/tokens';import {defaultLifecycle} from '../src/lib/lifecycle';
const db=await PGlite.create();const server=new PGLiteSocketServer({db,host:'127.0.0.1',port:55440});await server.start();
const env={...process.env,DATABASE_URL:'postgresql://postgres:postgres@127.0.0.1:55440/postgres',PUBLIC_SITE_URL:'http://127.0.0.1:4323'};
const run=(args:string[])=>new Promise<void>((resolve,reject)=>{const child=spawn(process.execPath,args,{env,stdio:'inherit'});child.on('exit',code=>code===0?resolve():reject(new Error('Process failed '+code)))});
await run(['--import','tsx','scripts/migrate.ts']);await run(['--import','tsx','scripts/migrate.ts']);
const token=generateToken();const config=defaultLifecycle();config.invitation.startsAt='2020-01-01T00:00:00Z';config.rsvp.startsAt='2020-01-01T00:00:00Z';config.gifts.startsAt='2020-01-01T00:00:00Z';
await db.query('UPDATE events SET lifecycle=$1',[config]);
await db.query("INSERT INTO invitations(event_id,display_name,type,token_hash,max_guests) SELECT id,'Família de Teste','family',$1,4 FROM events WHERE slug='anna-sophie-xv'",[hashToken(token)]);
console.log('QA synthetic invitation: http://127.0.0.1:4323/confirmar-presenca/'+token);
const child=spawn(process.execPath,['node_modules/astro/astro.js','dev','--host','127.0.0.1','--port','4323'],{env,stdio:'inherit'});
process.on('SIGINT',async()=>{child.kill();await server.stop();await db.close();process.exit(0)});
