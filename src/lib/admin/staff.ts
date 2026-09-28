import {database} from '../db';
import {audit} from './audit';
import type {AdminUser} from './auth';
import {AdminError} from './invitations';

type FormValues={get(name:string):unknown};
const clean=(value:unknown,max:number)=>String(value||'').trim().slice(0,max);

export async function listStaff(eventId:number){
 return(await database().query('SELECT * FROM event_staff WHERE event_id=$1 ORDER BY active DESC,name',[eventId])).rows;
}

function fields(form:FormValues){
 const name=clean(form.get('name'),120);
 if(name.length<2)throw new AdminError('Informe o nome.');
 return{name,role_description:clean(form.get('role_description'),120)||null,phone:clean(form.get('phone'),25)||null,notes:clean(form.get('notes'),1000)||null};
}

export async function saveStaff(form:FormValues,user:AdminUser){
 const value=fields(form),id=Number(form.get('staff_id')||0),client=await database().connect();
 try{
  await client.query('BEGIN');
  let before=null,row,action;
  if(id){
   before=(await client.query('SELECT * FROM event_staff WHERE id=$1 AND event_id=$2 FOR UPDATE',[id,user.eventId])).rows[0];
   row=(await client.query('UPDATE event_staff SET name=$1,role_description=$2,phone=$3,notes=$4,updated_at=now() WHERE id=$5 AND event_id=$6 RETURNING *',[value.name,value.role_description,value.phone,value.notes,id,user.eventId])).rows[0];
   action='STAFF_UPDATE';
  }else{
   row=(await client.query('INSERT INTO event_staff(event_id,name,role_description,phone,notes) VALUES($1,$2,$3,$4,$5) RETURNING *',[user.eventId,value.name,value.role_description,value.phone,value.notes])).rows[0];
   action='STAFF_CREATE';
  }
  if(!row)throw new AdminError('Membro da equipe não encontrado.');
  await audit(client,user.id,action,'event_staff',row.id,before,row);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}

export async function toggleStaff(form:FormValues,user:AdminUser){
 const id=Number(form.get('staff_id')),active=String(form.get('active'))==='true',client=await database().connect();
 try{
  await client.query('BEGIN');
  const before=(await client.query('SELECT * FROM event_staff WHERE id=$1 AND event_id=$2 FOR UPDATE',[id,user.eventId])).rows[0];
  const row=(await client.query('UPDATE event_staff SET active=$1,updated_at=now() WHERE id=$2 AND event_id=$3 RETURNING *',[active,id,user.eventId])).rows[0];
  if(!row)throw new AdminError('Membro da equipe não encontrado.');
  await audit(client,user.id,active?'STAFF_ACTIVATE':'STAFF_DEACTIVATE','event_staff',id,before,row);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
