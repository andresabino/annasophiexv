import {S3Client,PutObjectCommand} from '@aws-sdk/client-s3';
import {randomUUID} from 'node:crypto';
export async function uploadPhoto(body:Uint8Array,extension:'webp'|'avif'){
 const required=['R2_ENDPOINT','R2_ACCESS_KEY_ID','R2_SECRET_ACCESS_KEY','R2_BUCKET_NAME','R2_PUBLIC_URL'];
 if(required.some(key=>!process.env[key])) throw new Error('Configure as variáveis R2 antes do upload.');
 const client=new S3Client({region:'auto',endpoint:process.env.R2_ENDPOINT,credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID!,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY!}});
 const key='anna-sophie/'+randomUUID()+'.'+extension;
 await client.send(new PutObjectCommand({Bucket:process.env.R2_BUCKET_NAME,Key:key,Body:body,ContentType:'image/'+extension,CacheControl:'public, max-age=31536000, immutable'}));
 return process.env.R2_PUBLIC_URL!.replace(/\/$/,'')+'/'+key;
}