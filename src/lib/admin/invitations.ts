import type pg from 'pg';
import {database,EVENT_SLUG} from '../db';
import {generateToken,hashToken} from '../tokens';
import {encryptToken,decryptToken} from './token-vault';
import {audit} from './audit';

export class AdminError extends Error { constructor(message:string,public status=400){super(message)} }
const text=(value:unknown,max:number)=>String(value||'').trim().slice(0,max);

export function invitationInput(form:FormData){
 const expected=Number(form.get('expected_guests')),max=Number(form.get('max_guests')),round=Number(form.get('invitation_round'));
 if(!text(form.get('display_name'),120))throw new AdminError('Informe o nome do convite.');
 if(!['individual','couple','family','group'].includes(String(form.get('type'))))throw new AdminError('Tipo inválido.');
 if(!Number.isInteger(expected)||expected<1||expected>100||!Number.isInteger(max)||max<1||max>100||!Number.isInteger(round)||round<1)throw new AdminError('Revise previstos, limite e rodada.');
 let deadline=text(form.get('rsvp_deadline'),40);if(/^\d{4}-\d{2}-\d{2}$/.test(deadline))deadline+='T23:59:59-03:00';if(deadline&&!Number.isFinite(Date.parse(deadline)))throw new AdminError('Prazo inválido.');
 return {display_name:text(form.get('display_name'),120),type:String(form.get('type')),phone:text(form.get('phone'),25),expected_guests:expected,max_guests:max,invitation_round:round,rsvp_deadline:deadline||null,notes:text(form.get('notes'),2000),participants:form.getAll('participant').map(v=>text(v,120)).filter(Boolean)};
}
async function eventId(client:pg.PoolClient){return (await client.query('SELECT id FROM events WHERE slug=$1',[EVENT_SLUG])).rows[0].id;}

export async function createInvitation(form:FormData,userId:number){
 const value=invitationInput(form),token=generateToken(),client=await database().connect();
 try{await client.query('BEGIN');const eid=await eventId(client);const {rows}=await client.query(`INSERT INTO invitations(event_id,display_name,type,phone,expected_guests,max_guests,invitation_round,rsvp_deadline,token_hash,token_ciphertext,notes) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,[eid,value.display_name,value.type,value.phone,value.expected_guests,value.max_guests,value.invitation_round,value.rsvp_deadline,hashToken(token),encryptToken(token),value.notes]);for(const name of value.participants)await client.query('INSERT INTO guests(event_id,invitation_id,first_name,is_expected) VALUES($1,$2,$3,true)',[eid,rows[0].id,name]);await audit(client,userId,'CREATE_INVITATION','invitation',rows[0].id,null,value);await client.query('COMMIT');return rows[0].id;}
 catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}

export async function listInvitations(query='',filter='',round=''){
 const params:any[]=[EVENT_SLUG],where=['e.slug=$1'];
 if(query){params.push('%'+query+'%');where.push(`(i.display_name ILIKE $${params.length} OR i.phone ILIKE $${params.length} OR EXISTS(SELECT 1 FROM guests g WHERE g.invitation_id=i.id AND concat_ws(' ',g.first_name,g.last_name) ILIKE $${params.length}))`)}
 if(round){params.push(Number(round));where.push(`i.invitation_round=$${params.length}`)}
 const status:Record<string,string>={not_delivered:'i.delivered_at IS NULL AND i.revoked_at IS NULL',delivered:'i.delivered_at IS NOT NULL',viewed:'i.first_viewed_at IS NOT NULL',pending:'r.id IS NULL AND i.revoked_at IS NULL',confirmed:"r.status='confirmed'",declined:"r.status IN ('declined','cancelled')",overdue:'r.id IS NULL AND i.rsvp_deadline<now() AND i.revoked_at IS NULL',revoked:'i.revoked_at IS NOT NULL'};
 if(status[filter])where.push(status[filter]);
 return (await database().query(`SELECT i.*,r.status rsvp_status,COALESCE(r.confirmed_guests,0) confirmed_guests FROM invitations i JOIN events e ON e.id=i.event_id LEFT JOIN rsvps r ON r.invitation_id=i.id WHERE ${where.join(' AND ')} ORDER BY i.invitation_round,i.display_name`,params)).rows;
}
export async function getInvitation(id:number){return (await database().query(`SELECT i.*,r.id rsvp_id,r.status rsvp_status,COALESCE(r.confirmed_guests,0) confirmed_guests,r.phone rsvp_phone,r.notes rsvp_notes,COALESCE((SELECT json_agg(g.first_name ORDER BY g.id) FROM guests g WHERE g.invitation_id=i.id),'[]') expected_participants,COALESCE((SELECT json_agg(p.name ORDER BY p.id) FROM rsvp_participants p WHERE p.rsvp_id=r.id),'[]') participants,COALESCE((SELECT json_agg(COALESCE(p.age_band,'') ORDER BY p.id) FROM rsvp_participants p WHERE p.rsvp_id=r.id),'[]') participant_age_bands FROM invitations i LEFT JOIN rsvps r ON r.invitation_id=i.id WHERE i.id=$1`,[id])).rows[0]||null;}
export function invitationLink(invitation:any){return invitation.token_ciphertext?`${process.env.PUBLIC_SITE_URL||'http://localhost:4321'}/confirmar-presenca/${decryptToken(invitation.token_ciphertext)}`:null;}

export async function updateInvitation(id:number,form:FormData,userId:number){
 const value=invitationInput(form),version=String(form.get('updated_at')),client=await database().connect();
 try{await client.query('BEGIN');const before=(await client.query('SELECT * FROM invitations WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!before)throw new AdminError('Convite não encontrado.',404);if(new Date(before.updated_at).toISOString()!==new Date(version).toISOString())throw new AdminError('Este convite foi alterado por outro usuário. Atualize os dados antes de salvar novamente.',409);const {rows}=await client.query(`UPDATE invitations SET display_name=$1,type=$2,phone=$3,expected_guests=$4,max_guests=$5,invitation_round=$6,rsvp_deadline=$7,notes=$8,updated_at=now() WHERE id=$9 RETURNING *`,[value.display_name,value.type,value.phone,value.expected_guests,value.max_guests,value.invitation_round,value.rsvp_deadline,value.notes,id]);await client.query('DELETE FROM guests WHERE invitation_id=$1',[id]);for(const name of value.participants)await client.query('INSERT INTO guests(event_id,invitation_id,first_name,is_expected) VALUES($1,$2,$3,true)',[before.event_id,id,name]);await audit(client,userId,'UPDATE_INVITATION','invitation',id,before,rows[0]);await client.query('COMMIT');}
 catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}

export async function invitationAction(id:number,action:string,userId:number,reason=''){
 const client=await database().connect();
 try{await client.query('BEGIN');const before=(await client.query('SELECT * FROM invitations WHERE id=$1 FOR UPDATE',[id])).rows[0];if(!before)throw new AdminError('Convite não encontrado.',404);let after=before;
  if(action==='deliver')after=(await client.query('UPDATE invitations SET delivered_at=COALESCE(delivered_at,now()),updated_at=now() WHERE id=$1 RETURNING *',[id])).rows[0];
  else if(action==='release'){if(!reason.trim())throw new AdminError('Informe o motivo da liberação.');const response=(await client.query('SELECT status FROM rsvps WHERE invitation_id=$1',[id])).rows[0];if(response?.status==='confirmed')throw new AdminError('Cancele ou altere o RSVP confirmado antes de liberar estas vagas.');const replacement=generateToken();after=(await client.query('UPDATE invitations SET active=false,revoked_at=now(),revoked_reason=$2,token_hash=$3,token_ciphertext=NULL,updated_at=now() WHERE id=$1 RETURNING *',[id,reason.trim(),hashToken(replacement)])).rows[0];}
  else if(action==='regenerate'){const token=generateToken();after=(await client.query('UPDATE invitations SET active=true,revoked_at=NULL,revoked_reason=NULL,token_hash=$2,token_ciphertext=$3,updated_at=now() WHERE id=$1 RETURNING *',[id,hashToken(token),encryptToken(token)])).rows[0];}
  else throw new AdminError('Ação inválida.');
  await audit(client,userId,action==='deliver'?'MARK_DELIVERED':action==='release'?'RELEASE_CAPACITY':'REGENERATE_TOKEN','invitation',id,before,after);await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
