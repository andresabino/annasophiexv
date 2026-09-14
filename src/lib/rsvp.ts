import {database,EVENT_SLUG} from './db';
import {hashToken,validToken} from './tokens';
import {isRsvpOpen,validateLifecycle} from './lifecycle';
export class RsvpError extends Error {constructor(message:string,public status=400){super(message)}}
export function validateResponse(input:Record<string,unknown>,max:number){
  if(!['confirmed','declined'].includes(String(input.status))) throw new RsvpError('Escolha sua resposta.');
  const status=String(input.status);
  const count=Number(input.quantity);
  const names=Array.isArray(input.participants)?input.participants:[];
  if(status==='confirmed'&&(!Number.isInteger(count)||count<1||count>max)) throw new RsvpError(`Este convite permite até ${max} pessoas.`);
  if(status==='confirmed'&&(names.length!==count||names.some(n=>typeof n!=='string'||n.trim().length<2||n.trim().length>120))) throw new RsvpError('Informe o nome de cada participante (2 a 120 caracteres).');
  const phone=typeof input.phone==='string'?input.phone.trim():'';
  const notes=typeof input.notes==='string'?input.notes.trim():'';
  if(status==='confirmed'&&(!/^\+?[\d\s()\-]{10,25}$/.test(phone)||phone.replace(/\D/g,'').length<10)) throw new RsvpError('Informe um WhatsApp válido com DDD.');
  if(notes.length>1000 || phone.length>25) throw new RsvpError('Revise o tamanho dos campos.');
  return {status,count:status==='confirmed'?count:0,names:status==='confirmed'?names.map(n=>String(n).trim()):[],phone,notes};
}
export async function findInvitation(token:string){
  if(!validToken(token)) return null;
  const {rows}=await database().query(`SELECT i.display_name,i.max_guests,r.status,r.confirmed_guests,r.phone,r.notes,
    COALESCE((SELECT json_agg(p.name ORDER BY p.id) FROM rsvp_participants p WHERE p.rsvp_id=r.id),'[]') participants
    FROM invitations i JOIN events e ON e.id=i.event_id LEFT JOIN rsvps r ON r.invitation_id=i.id
    WHERE i.token_hash=$1 AND e.slug=$2 AND i.active AND i.revoked_at IS NULL AND (i.expires_at IS NULL OR i.expires_at>now())`,[hashToken(token),EVENT_SLUG]);
  return rows[0]||null;
}
export async function saveResponse(token:string,input:Record<string,unknown>){
  if(!validToken(token)) throw new RsvpError('Convite indisponível.',404);
  const client=await database().connect();
  try{
    await client.query('BEGIN');
    const {rows}=await client.query(`SELECT i.id,i.event_id,i.max_guests,e.lifecycle FROM invitations i JOIN events e ON e.id=i.event_id
      WHERE i.token_hash=$1 AND e.slug=$2 AND i.active AND i.revoked_at IS NULL AND (i.expires_at IS NULL OR i.expires_at>now()) FOR UPDATE OF i FOR SHARE OF e`,[hashToken(token),EVENT_SLUG]);
    const invitation=rows[0];
    if(!invitation) throw new RsvpError('Convite indisponível.',404);
    if(!isRsvpOpen(validateLifecycle(invitation.lifecycle))) throw new RsvpError('As confirmações para o baile estão fechadas.',403);
    const value=validateResponse(input,invitation.max_guests);
    const result=await client.query(`INSERT INTO rsvps(event_id,invitation_id,status,confirmed_guests,phone,notes,confirmed_at)
      VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $3='confirmed' THEN now() ELSE NULL END)
      ON CONFLICT(invitation_id) DO UPDATE SET status=EXCLUDED.status,confirmed_guests=EXCLUDED.confirmed_guests,phone=EXCLUDED.phone,notes=EXCLUDED.notes,confirmed_at=EXCLUDED.confirmed_at,updated_at=now() RETURNING id`,[invitation.event_id,invitation.id,value.status,value.count,value.phone,value.notes]);
    await client.query('DELETE FROM rsvp_participants WHERE rsvp_id=$1',[result.rows[0].id]);
    for(const name of value.names) await client.query('INSERT INTO rsvp_participants(rsvp_id,name) VALUES($1,$2)',[result.rows[0].id,name]);
    await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
}
