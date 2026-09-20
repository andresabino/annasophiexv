import {database} from '../db';
import {validateResponse} from '../rsvp';
import {audit} from './audit';

export async function saveManualResponse(invitationId:number,input:Record<string,unknown>,userId:number){
 const client=await database().connect();
 try{
  await client.query('BEGIN');
  const invitation=(await client.query('SELECT i.*,r.id rsvp_id,r.status previous_status,r.confirmed_guests previous_count FROM invitations i LEFT JOIN rsvps r ON r.invitation_id=i.id WHERE i.id=$1 FOR UPDATE OF i',[invitationId])).rows[0];
  if(!invitation||!invitation.active||invitation.revoked_at)throw new Error('Convite indisponível para RSVP.');
  const rawParticipants=Array.isArray(input.participants)?input.participants:[],rawBands=Array.isArray(input.ageBands)?input.ageBands:[];
  const participants:string[]=[],ageBands:string[]=[];
  rawParticipants.forEach((participant,index)=>{if(String(participant).trim()){participants.push(String(participant));ageBands.push(String(rawBands[index]||''))}});
  const value=validateResponse({...input,participants,ageBands},invitation.max_guests);
  const result=await client.query(`INSERT INTO rsvps(event_id,invitation_id,status,confirmed_guests,phone,notes,confirmed_at)
   VALUES($1,$2,$3,$4,$5,$6,CASE WHEN $3='confirmed' THEN now() ELSE NULL END)
   ON CONFLICT(invitation_id) DO UPDATE SET status=EXCLUDED.status,confirmed_guests=EXCLUDED.confirmed_guests,phone=EXCLUDED.phone,notes=EXCLUDED.notes,confirmed_at=EXCLUDED.confirmed_at,updated_at=now() RETURNING id`,[invitation.event_id,invitation.id,value.status,value.count,value.phone,value.notes]);
  await client.query('DELETE FROM rsvp_participants WHERE rsvp_id=$1',[result.rows[0].id]);
  for(let index=0;index<value.names.length;index++)await client.query('INSERT INTO rsvp_participants(rsvp_id,name,age_band) VALUES($1,$2,$3)',[result.rows[0].id,value.names[index],value.ageBands[index]||null]);
  await client.query('UPDATE invitations SET responded_at=now(),updated_at=now() WHERE id=$1',[invitation.id]);
  const participantSnapshot=value.names.map((name,index)=>({name,ageBand:value.ageBands[index]||null}));
  await client.query('INSERT INTO rsvp_history(rsvp_id,changed_by_type,admin_user_id,previous_status,new_status,previous_confirmed_guests,new_confirmed_guests,snapshot) VALUES($1,\'ADMIN\',$2,$3,$4,$5,$6,$7)',[result.rows[0].id,userId,invitation.previous_status,value.status,invitation.previous_count,value.count,{phone:value.phone,participants:participantSnapshot,notes:value.notes}]);
  await audit(client,userId,'MANUAL_RSVP','invitation',invitation.id,{status:invitation.previous_status,confirmed_guests:invitation.previous_count},{status:value.status,confirmed_guests:value.count,participants:participantSnapshot});
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
