import {database,EVENT_SLUG} from '../src/lib/db';
import {hashPassword} from '../src/lib/admin/auth';
const [name,email,role='EDITOR']=process.argv.slice(2),password=process.env.ADMIN_INITIAL_PASSWORD;
if(!name||!email||!['ADMIN','EDITOR'].includes(role)||!password)throw new Error('Uso: defina ADMIN_INITIAL_PASSWORD e execute npm run admin:provision -- "Nome" email@dominio.com ADMIN|EDITOR');
const client=await database().connect();
try{
 const passwordHash=await hashPassword(password);await client.query('BEGIN');
 const user=(await client.query(`INSERT INTO admin_users(name,email,password_hash,role) VALUES($1,$2,$3,$4) ON CONFLICT(email) DO UPDATE SET name=EXCLUDED.name,password_hash=EXCLUDED.password_hash,role=EXCLUDED.role,active=true,updated_at=now() RETURNING id`,[name,email.toLowerCase(),passwordHash,role])).rows[0];
 const event=(await client.query('SELECT id FROM events WHERE slug=$1',[EVENT_SLUG])).rows[0];if(!event)throw new Error('Evento não encontrado.');
 await client.query('INSERT INTO admin_user_events(admin_user_id,event_id) VALUES($1,$2) ON CONFLICT DO NOTHING',[user.id,event.id]);
 await client.query('COMMIT');console.log('Usuário provisionado com segurança:',name,role);
}catch(error){await client.query('ROLLBACK');throw error}finally{client.release();await database().end()}
