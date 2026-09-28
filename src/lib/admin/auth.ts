import {createHash,randomBytes,scrypt as scryptCb,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {database,EVENT_SLUG} from '../db';
const scrypt=promisify(scryptCb);
export type AdminRole='ADMIN'|'EDITOR';
export type AdminUser={id:number;name:string;email:string;role:AdminRole;eventId:number};
type FormValues={get(name:string):unknown};
export const SESSION_COOKIE='anna_admin_session';
export async function hashPassword(password:string){
 if(password.length<12)throw new Error('A senha deve ter pelo menos 12 caracteres.');
 const salt=randomBytes(16);const key=await scrypt(password,salt,64) as Buffer;
 return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`;
}
export async function verifyPassword(password:string,stored:string){
 const [kind,salt,value]=stored.split('$');if(kind!=='scrypt'||!salt||!value)return false;
 const key=await scrypt(password,Buffer.from(salt,'base64url'),64) as Buffer;const expected=Buffer.from(value,'base64url');
 return key.length===expected.length&&timingSafeEqual(key,expected);
}
const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export const csrfToken=(sessionToken:string)=>digest(`csrf:${sessionToken}`);
export function assertCsrf(form:FormValues,sessionToken:string){
 const supplied=String(form.get('_csrf')||''),expected=csrfToken(sessionToken);
 const left=Buffer.from(supplied),right=Buffer.from(expected);
 if(left.length!==right.length||!timingSafeEqual(left,right))throw new Response('Requisição inválida.',{status:403});
}
export async function createSession(userId:number){
 const token=randomBytes(32).toString('base64url');
 await database().query("DELETE FROM admin_sessions WHERE expires_at<=now() OR admin_user_id=$1",[userId]);
 await database().query("INSERT INTO admin_sessions(admin_user_id,token_hash,expires_at) VALUES($1,$2,now()+interval '8 hours')",[userId,digest(token)]);
 return token;
}
export async function getSession(token?:string|null):Promise<AdminUser|null>{
 if(!token)return null;
 const {rows}=await database().query(`SELECT u.id,u.name,u.email,u.role,e.id event_id FROM admin_sessions s
 JOIN admin_users u ON u.id=s.admin_user_id JOIN admin_user_events aue ON aue.admin_user_id=u.id
 JOIN events e ON e.id=aue.event_id WHERE s.token_hash=$1 AND s.expires_at>now() AND u.active AND e.slug=$2`,[digest(token),EVENT_SLUG]);
 if(rows[0])await database().query('UPDATE admin_sessions SET last_seen_at=now() WHERE token_hash=$1',[digest(token)]);
 return rows[0]?{...rows[0],eventId:rows[0].event_id}:null;
}
export async function destroySession(token?:string|null){if(token)await database().query('DELETE FROM admin_sessions WHERE token_hash=$1',[digest(token)]);}
export const cookieOptions=(production:boolean)=>({path:'/',httpOnly:true,sameSite:'strict' as const,secure:production,maxAge:8*60*60});
export function requireRole(user:AdminUser,role:AdminRole){if(role==='ADMIN'&&user.role!=='ADMIN')throw new Response('Acesso restrito a administradores.',{status:403});}
