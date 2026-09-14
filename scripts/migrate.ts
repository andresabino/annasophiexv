import {readFile,readdir} from 'node:fs/promises';
import {database,EVENT_SLUG} from '../src/lib/db';
import {defaultLifecycle,validateLifecycle} from '../src/lib/lifecycle';
import {giftCatalog} from '../src/lib/gifts';
const client=await database().connect();
try {
await client.query('BEGIN');
await client.query("SELECT pg_advisory_xact_lock(15312026)");
await client.query('CREATE TABLE IF NOT EXISTS schema_migrations(version text PRIMARY KEY,applied_at timestamptz NOT NULL DEFAULT now())');
for(const file of (await readdir(new URL('../db/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort()){
 if((await client.query('SELECT 1 FROM schema_migrations WHERE version=$1',[file])).rowCount) continue;
 await client.query(await readFile(new URL('../db/migrations/'+file,import.meta.url),'utf8'));
 await client.query('INSERT INTO schema_migrations(version) VALUES($1)',[file]);
}
const event=(await client.query('SELECT id,lifecycle FROM events WHERE slug=$1',[EVENT_SLUG])).rows[0];
if(JSON.stringify(event.lifecycle)==='{}'){
 const config=defaultLifecycle();
 for(const [key,prefix] of Object.entries({saveTheDate:'SAVE_THE_DATE',invitation:'INVITATION',rsvp:'RSVP',gifts:'GIFTS',pix:'PIX'})) Object.assign(config[key as keyof typeof config],{startsAt:process.env[prefix+'_STARTS_AT']||null,endsAt:process.env[prefix+'_ENDS_AT']||null});
 config.postEvent.startsAt=process.env.POST_EVENT_STARTS_AT||null;
 await client.query('UPDATE events SET lifecycle=$1 WHERE id=$2',[validateLifecycle(config),event.id]);
}
for(const [order,category] of giftCatalog.entries()){
 const result=await client.query('INSERT INTO gift_categories(event_id,name,slug,sort_order) VALUES($1,$2,$3,$4) ON CONFLICT(event_id,slug) DO UPDATE SET slug=EXCLUDED.slug RETURNING id',[event.id,category.name,category.slug,order]);
 const id=result.rows[0].id;
 if(!(await client.query('SELECT 1 FROM gifts WHERE category_id=$1 LIMIT 1',[id])).rowCount) for(const [i,gift] of category.items.entries()) await client.query('INSERT INTO gifts(event_id,category_id,name,brand,external_url,size,sort_order) VALUES($1,$2,$3,$3,$4,$5,$6)',[event.id,id,gift.brand,gift.url,category.size||null,i]);
}
for(const [order,name] of ['Anna Sophie','Família','Amigos','Cerimônia','Valsa','Baile','Pista','Detalhes','Bastidores'].entries()) await client.query('INSERT INTO photo_albums(event_id,name,slug,sort_order) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING',[event.id,name,name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replaceAll(' ','-'),order]);
await client.query('COMMIT');console.log('Migrations e catálogo aplicados.');
}catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();await database().end();}