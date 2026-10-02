import type {APIRoute} from 'astro';
import {MAX_GUEST_PHOTOS,guestGalleryCanUpload,guestGallerySettings,submitGuestPhoto} from '../../../lib/guest-gallery';
import {siteState} from '../../../lib/config';

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}});

export const POST:APIRoute=async({request,url})=>{
 try{
  const [state,settings]=await Promise.all([siteState(url),guestGallerySettings()]);
  if(!guestGalleryCanUpload(state.phase,settings.enabled))return json({error:'O envio de fotos não está disponível neste momento.'},403);
  const form=await request.formData();
  const files=form.getAll('photos').filter((value):value is File=>value instanceof File&&value.size>0);
  if(!files.length)return json({error:'Selecione pelo menos uma foto.'},400);
  if(files.length>MAX_GUEST_PHOTOS)return json({error:'Envie no máximo 10 fotos por vez.'},400);
  const name=form.get('uploaderName');
  if(String(name||'').trim().length>80)return json({error:'O nome deve ter no máximo 80 caracteres.'},400);
  const results=[];
  for(const file of files){
   try{const saved=await submitGuestPhoto(file,name);results.push({name:file.name,ok:true,id:saved.id})}
   catch(error){results.push({name:file.name,ok:false,error:error instanceof Error?error.message:'Não foi possível enviar esta foto.'})}
  }
  const accepted=results.filter(item=>item.ok).length;
  return json({accepted,failed:results.length-accepted,results,message:accepted?'Fotos enviadas com sucesso! Elas aparecerão na galeria após a aprovação.':'Nenhuma foto foi enviada.'},accepted?201:422);
 }catch(error){
  console.error('Guest gallery upload failed:',error instanceof Error?error.message:'UnknownError');
  return json({error:'Não foi possível processar o envio. Tente novamente.'},500);
 }
};
