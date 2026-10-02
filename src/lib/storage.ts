import {DeleteObjectsCommand,PutObjectCommand,S3Client} from '@aws-sdk/client-s3';
import {randomUUID} from 'node:crypto';
function storageConfig(){
 const required=['R2_ENDPOINT','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','R2_PUBLIC_URL'];
 if(required.some(key=>!process.env[key])) throw new Error('Configure as variáveis R2 antes do upload.');
 return {bucket:process.env.R2_BUCKET_NAME!,publicUrl:process.env.R2_PUBLIC_URL!.replace(/\/$/,''),client:new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID!,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY!}})};
}
export async function uploadPhoto(body:Uint8Array,extension:'webp'|'avif'){
 const {client,bucket,publicUrl}=storageConfig();
 const key='anna-sophie/'+randomUUID()+'.'+extension;
 await client.send(new PutObjectCommand({Bucket:bucket,Key:key,Body:body,ContentType:'image/'+extension,CacheControl:'public, max-age=31536000, immutable'}));
 return publicUrl+'/'+key;
}

export async function uploadGuestPhoto(original:Uint8Array,thumbnail:Uint8Array,submittedAt=new Date()){
 const {client,bucket,publicUrl}=storageConfig();
 const day=submittedAt.toISOString().slice(0,10).replaceAll('-','/');
 const id=randomUUID(),prefix=`anna-sophie/guest-gallery/${day}/${id}`;
 const objectKey=prefix+'.webp',thumbnailObjectKey=prefix+'.thumb.webp';
 await client.send(new PutObjectCommand({Bucket:bucket,Key:objectKey,Body:original,ContentType:'image/webp',CacheControl:'public, max-age=31536000, immutable'}));
 try{
  await client.send(new PutObjectCommand({Bucket:bucket,Key:thumbnailObjectKey,Body:thumbnail,ContentType:'image/webp',CacheControl:'public, max-age=31536000, immutable'}));
 }catch(error){
  await client.send(new DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:[{Key:objectKey}],Quiet:true}})).catch(()=>{});
  throw error;
 }
 return {objectKey,thumbnailObjectKey,imageUrl:`${publicUrl}/${objectKey}`,thumbnailUrl:`${publicUrl}/${thumbnailObjectKey}`};
}

export async function deleteStoredObjects(keys:string[]){
 if(!keys.length)return;
 const {client,bucket}=storageConfig();
 await client.send(new DeleteObjectsCommand({Bucket:bucket,Delete:{Objects:keys.map(Key=>({Key})),Quiet:true}}));
}
