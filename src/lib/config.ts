import { database, EVENT_SLUG } from './db';
import { defaultLifecycle, validateLifecycle, getCurrentSitePhase, resolvePreview, isGiftListActive, isPixActive, isRsvpOpen } from './lifecycle';
export const eventConfig={timezone:'America/Sao_Paulo',event:{startsAt:'2026-12-06T18:15:00-03:00',name:'Anna Sophie — XV Anos',venue:'Estação 840',address:'Avenida Marechal Rondon, 840 — Centro, Osasco/SP'}};
export async function lifecycleConfig(){
  let config=defaultLifecycle();
  if(process.env.DATABASE_URL){
    const result=await database().query('SELECT lifecycle FROM events WHERE slug=$1',[EVENT_SLUG]);
    if(result.rows[0]) config=validateLifecycle(result.rows[0].lifecycle);
  }else{
    for(const [key,prefix] of Object.entries({saveTheDate:'SAVE_THE_DATE',invitation:'INVITATION',rsvp:'RSVP',gifts:'GIFTS',pix:'PIX'})){
      Object.assign(config[key as keyof typeof config],{startsAt:process.env[prefix+'_STARTS_AT']||null,endsAt:process.env[prefix+'_ENDS_AT']||null});
    }
    config.postEvent.startsAt=process.env.POST_EVENT_STARTS_AT||null;
  }
  config.pix.enabled=process.env.PIX_ENABLED==='true';
  return validateLifecycle(config);
}
export async function siteState(url:URL){
  const config=await lifecycleConfig();
  const now=new Date();
  const phase=resolvePreview(getCurrentSitePhase(config,now),url.searchParams.get('previewPhase'),import.meta.env.DEV);
  const preview=import.meta.env.DEV && url.searchParams.has('previewPhase');
  return {config,phase,preview,gifts:phase!=='POST_EVENT'&&(isGiftListActive(config,now)||preview&&phase!=='SAVE_THE_DATE'),pix:phase!=='POST_EVENT'&&isPixActive(config,now),rsvp:phase!=='POST_EVENT'&&(isRsvpOpen(config,now)||preview&&phase!=='SAVE_THE_DATE')};
}
export function siteUrl(){return (process.env.PUBLIC_SITE_URL||'http://localhost:4321').replace(/\/$/,'');}
