import sharp,{type Metadata} from 'sharp';
import {database,EVENT_SLUG} from './db';
import type {Phase} from './lifecycle';
import {deleteStoredObjects,uploadGuestPhoto} from './storage';
import {audit} from './admin/audit';
import type {AdminUser} from './admin/auth';

export const MAX_GUEST_PHOTOS=10;
export const MAX_GUEST_PHOTO_BYTES=10*1024*1024;
export type GuestPhotoStatus='PENDING'|'APPROVED'|'REJECTED';

export function guestGalleryCanUpload(phase:Phase,enabled:boolean){return enabled&&(phase==='EVENT_DAY'||phase==='POST_EVENT')}
export function guestGalleryCanView(phase:Phase){return phase==='POST_EVENT'}

export async function guestGallerySettings(){
 if(!process.env.DATABASE_URL)return {enabled:false};
 const {rows}=await database().query('SELECT guest_gallery_uploads_enabled enabled FROM events WHERE slug=$1',[EVENT_SLUG]);
 return {enabled:rows[0]?.enabled===true};
}

export async function approvedGuestPhotos(){
 if(!process.env.DATABASE_URL)return [];
 const {rows}=await database().query(`SELECT p.id,p.image_url,p.thumbnail_url,p.uploader_name,p.submitted_at,p.featured
  FROM guest_photos p JOIN events e ON e.id=p.event_id
  WHERE e.slug=$1 AND p.status='APPROVED' ORDER BY p.featured DESC,p.submitted_at DESC`,[EVENT_SLUG]);
 return rows as {id:number;image_url:string;thumbnail_url:string;uploader_name:string|null;submitted_at:string;featured:boolean}[];
}

function senderName(value:unknown){
 const name=String(value||'').trim();
 if(name.length>80)throw new Error('O nome deve ter no máximo 80 caracteres.');
 return name||null;
}

export async function submitGuestPhoto(file:File,name:unknown){
 if(file.size===0)throw new Error('O arquivo está vazio.');
 if(file.size>MAX_GUEST_PHOTO_BYTES)throw new Error('A foto deve ter no máximo 10 MB.');
 const input=Buffer.from(await file.arrayBuffer());
 let metadata:Metadata;
 try{metadata=await sharp(input,{limitInputPixels:40_000_000,animated:false}).metadata()}catch{throw new Error('O arquivo não é uma imagem válida.')}
 if(!metadata.format||!['jpeg','png','webp'].includes(metadata.format))throw new Error('Envie uma imagem JPG, PNG ou WebP.');
 if((metadata.pages||1)>1)throw new Error('Imagens animadas não são aceitas.');
 if(!metadata.width||!metadata.height)throw new Error('Não foi possível identificar as dimensões da foto.');
 const pipeline=sharp(input,{limitInputPixels:40_000_000}).rotate();
 const original=await pipeline.clone().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).webp({quality:86}).toBuffer();
 const thumbnail=await pipeline.clone().resize({width:720,height:720,fit:'cover',position:'attention',withoutEnlargement:true}).webp({quality:78}).toBuffer();
 const stored=await uploadGuestPhoto(original,thumbnail);
 try{
  const {rows}=await database().query(`INSERT INTO guest_photos(event_id,uploader_name,object_key,thumbnail_object_key,image_url,thumbnail_url,media_type,byte_size,width,height)
   SELECT id,$2,$3,$4,$5,$6,'image/webp',$7,$8,$9 FROM events WHERE slug=$1 RETURNING id,status`,[EVENT_SLUG,senderName(name),stored.objectKey,stored.thumbnailObjectKey,stored.imageUrl,stored.thumbnailUrl,original.byteLength,metadata.width,metadata.height]);
  if(!rows[0])throw new Error('Evento não encontrado.');
  return rows[0] as {id:number;status:GuestPhotoStatus};
 }catch(error){await deleteStoredObjects([stored.objectKey,stored.thumbnailObjectKey]).catch(()=>{});throw error}
}

export async function listGuestPhotos(eventId:number,status:GuestPhotoStatus){
 return (await database().query('SELECT * FROM guest_photos WHERE event_id=$1 AND status=$2 ORDER BY featured DESC,submitted_at DESC',[eventId,status])).rows;
}

export async function moderateGuestPhoto(id:number,action:'APPROVE'|'REJECT'|'FEATURE'|'UNFEATURE',user:AdminUser){
 const client=await database().connect();
 try{
  await client.query('BEGIN');
  const before=(await client.query('SELECT * FROM guest_photos WHERE id=$1 AND event_id=$2 FOR UPDATE',[id,user.eventId])).rows[0];
  if(!before)throw new Error('Foto não encontrada.');
  let row;
  if(action==='APPROVE'||action==='REJECT'){
   const status=action==='APPROVE'?'APPROVED':'REJECTED';
   row=(await client.query('UPDATE guest_photos SET status=$1,moderated_at=now(),moderated_by=$2,featured=CASE WHEN $1=\'APPROVED\' THEN featured ELSE false END,updated_at=now() WHERE id=$3 RETURNING *',[status,user.id,id])).rows[0];
  }else{
   if(before.status!=='APPROVED')throw new Error('Somente fotos aprovadas podem receber destaque.');
   row=(await client.query('UPDATE guest_photos SET featured=$1,updated_at=now() WHERE id=$2 RETURNING *',[action==='FEATURE',id])).rows[0];
  }
  await audit(client,user.id,`GUEST_PHOTO_${action}`,'guest_photos',id,before,row);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}

export async function deleteGuestPhoto(id:number,user:AdminUser){
 const client=await database().connect();
 try{
  await client.query('BEGIN');
  const before=(await client.query('SELECT * FROM guest_photos WHERE id=$1 AND event_id=$2 FOR UPDATE',[id,user.eventId])).rows[0];
  if(!before)throw new Error('Foto não encontrada.');
  await deleteStoredObjects([before.object_key,before.thumbnail_object_key]);
  await audit(client,user.id,'GUEST_PHOTO_DELETE','guest_photos',id,before,null);
  await client.query('DELETE FROM guest_photos WHERE id=$1',[id]);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}

export async function setGuestGalleryUploads(enabled:boolean,user:AdminUser){
 const client=await database().connect();
 try{
  await client.query('BEGIN');
  const before=(await client.query('SELECT id,guest_gallery_uploads_enabled FROM events WHERE id=$1 FOR UPDATE',[user.eventId])).rows[0];
  const after=(await client.query('UPDATE events SET guest_gallery_uploads_enabled=$1,updated_at=now() WHERE id=$2 RETURNING id,guest_gallery_uploads_enabled',[enabled,user.eventId])).rows[0];
  await audit(client,user.id,enabled?'GUEST_GALLERY_ENABLE':'GUEST_GALLERY_DISABLE','events',user.eventId,before,after);
  await client.query('COMMIT');
 }catch(error){await client.query('ROLLBACK');throw error}finally{client.release()}
}
