import {database,EVENT_SLUG} from './db';
import {hashToken,validToken} from './tokens';
import {isRsvpOpen,validateLifecycle} from './lifecycle';

export type ParticipantAgeBand = ''|'0_7'|'8_12';
export class RsvpError extends Error{constructor(message:string,public status=400){super(message)}}

export function validateResponse(input:Record<string,unknown>,max:number){
 if(!['confirmed','declined','cancelled'].includes(String(input.status)))throw new RsvpError('Escolha sua resposta.');
 const status=String(input.status),count=Number(input.quantity);
 const names=Array.isArray(input.participants)?input.participants:[];
 const submittedBands=Array.isArray(input.ageBands)?input.ageBands:[];
 if(status==='confirmed'&&(!Number.isInteger(count)||count<1||count>max))throw new RsvpError(`Este convite permite até ${max} pessoas.`);
 if(status==='confirmed'&&(names.length!==count||names.some(n=>typeof n!=='string'||n.trim().length<2||n.trim().length>120)))throw new RsvpError('Informe o nome de cada participante (2 a 120 caracteres).');
 const ageBands=Array.from({length:status==='confirmed'?count:0},(_,index)=>String(submittedBands[index]||'') as ParticipantAgeBand);
 if(ageBands.some(value=>!['','0_7','8_12'].includes(value)))throw new RsvpError('Faixa etária inválida.');
 const phone=typeof input.phone==='string'?input.phone.trim():'',notes=typeof input.notes==='string'?input.notes.trim():'';
 if(status==='confirmed'&&(!/^\+?[\d\s()\-]{10,25}$/.test(phone)||phone.replace(/\D/g,'').length<10))throw new RsvpError('Informe um WhatsApp válido com DDD.');
 if(notes.length>1000||phone.length>25)throw new RsvpError('Revise o tamanho dos campos.');
 return{status,count:status==='confirmed'?count:0,names:status==='confirmed'?names.map(n=>String(n).trim()):[],ageBands,phone,notes};
}

export async function findInvitation(token:string,recordView=true){
 if(!validToken(token))return null;
 const client=await database().connect();
 try{
  const {rows}=await client.query(`SELECT i.id,i.display_name,i.max_guests,i.rsvp_deadline,i.revoked_at,i.active,r.status,r.confirmed_guests,r.phone,r.notes,
   COALESCE((SELECT json_agg(p.name ORDER BY p.id) FROM rsvp_participants p WHERE p.rsvp_id=r.id),'[]') participants,
   COALESCE((SELECT json_agg(COALESCE(p.age_band,'') ORDER BY p.id) FROM rsvp_participants p WHERE p.rsvp_id=r.id),'[]') participant_age_bands
   FROM invitations i JOIN events e ON e.id=i.event_id LEFT JOIN rsvps r ON r.invitation_id=i.id
   WHERE i.token_hash=$1 AND e.slug=$2 AND i.active AND i.revoked_at IS NULL AND (i.expires_at IS NULL OR i.expires_at>now())`,[hashToken(token),EVENT_SLUG]);
  const item=rows[0];if(!item)return null;
  if(recordView&&item.active&&!item.revoked_at)await client.query('UPDATE invitations SET first_viewed_at=COALESCE(first_viewed_at,now()),last_viewed_at=now() WHERE id=$1',[item.id]);
  delete item.id;return item;
 }finally{client.release()}
}

export async function saveResponse(token:string,input:Record<string,unknown>,adminUserId?:number){
 if(!validToken(token))throw new RsvpError('Convite indisponível.',404);
 const client=await database().connect();
 try{
  await client.query('BEGIN');
  const {rows}=await client.query(`SELECT i.id,i.event_id,i.max_guests,i.rsvp_deadline,i.active,i.revoked_at,e.lifecycle,r.id rsvp_id,r.status previous_status,r.confirmed_guests previous_count
   FROM invitations i JOIN events e ON e.id=i.event_id LEFT JOIN rsvps r ON r.invitation_id=i.id
   WHERE i.token_hash=$1 AND e.slug=$2 FOR UPDATE OF i FOR SHARE OF e`,[hashToken(token),EVENT_SLUG]);
  const invitation=rows[0];
  if(!invitation||!invitation.active||invitation.revoked_at)throw new RsvpError('Este convite não está mais disponível para confirmação.',404);
  if(!adminUserId&&invitation.rsvp_deadline&&Date.now()>Date.parse(invitation.rsvp_deadline)&&!invitation.rsvp_id)throw new RsvpError('O prazo para confirmação deste convite foi encerrado.',403);
  if(!adminUserId&&!isRsvpOpen(validateLifecycle(invitation.lifecycle)))throw new RsvpError('As confirmações para o baile estão fechadas.',403);
  const value=validateResponse(input,invitation.max_guests);
  const result=await client.query(`INSERT INTO rsvps(event_id,invitation_id,status,confirmed_guests,phone,notes,confirmed_at)
   VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $3='confirmed' THEN now() ELSE NULL END)
   ON CONFLICT(invitation_id) DO UPDATE SET status=EXCLUDED.status,confirmed_guests=EXCLUDED.confirmed_guests,phone=EXCLUDED.phone,notes=EXCLUDED.notes,confirmed_at=EXCLUDED.confirmed_at,updated_at=now() RETURNING id`,[invitation.event_id,invitation.id,value.status,value.count,value.phone,value.notes]);
  await client.query('DELETE FROM rsvp_participants WHERE rsvp_id=$1',[result.rows[0].id]);
  for(let index=0;index<value.names.length;index++)await client.query('INSERT INTO rsvp_participants(rsvp_id,name,age_band) VALUES($1,$2,$3)',[result.rows[0].id,value.names[index],value.ageBands[index]||null]);
  await client.query('UPDATE invitations SET responded_at=now(),updated_at=now() WHERE id=$1',[invitation.id]);
  const participantSnapshot=value.names.map((name,index)=>({name,ageBand:value.ageBands[index]||null}));
  await client.query('INSERT INTO rsvp_history(rsvp_id,changed_by_type,admin_user_id,previous_status,new_status,previous_confirmed_guests,new_confirmed_guests,snapshot) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[result.rows[0].id,adminUserId?'ADMIN':'GUEST',adminUserId||null,invitation.previous_status,value.status,invitation.previous_count,value.count,{phone:value.phone,participants:participantSnapshot,notes:value.notes}]);
  if(adminUserId)await client.query("INSERT INTO audit_log(admin_user_id,action,entity_type,entity_id,before_data,after_data) VALUES($1,'MANUAL_RSVP','invitation',$2,$3,$4)",[adminUserId,invitation.id,{status:invitation.previous_status,confirmed_guests:invitation.previous_count},{status:value.status,confirmed_guests:value.count,participants:participantSnapshot}]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
