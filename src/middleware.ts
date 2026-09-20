import {defineMiddleware} from 'astro:middleware';import {getSession,SESSION_COOKIE} from './lib/admin/auth';
const rsvpBuckets=new Map<string,{count:number;reset:number}>(),loginBuckets=new Map<string,{count:number;reset:number}>();
function clientIp(context:any){try{return context.clientAddress}catch{return 'local'}}
function limited(map:Map<string,{count:number;reset:number}>,key:string,max:number,windowMs:number){const now=Date.now();for(const [k,v] of map)if(v.reset<now)map.delete(k);const item=map.get(key)||{count:0,reset:now+windowMs};item.count++;map.set(key,item);return item.count>max||map.size>10000;}
export const onRequest=defineMiddleware(async(context,next)=>{
 const path=context.url.pathname,ip=clientIp(context),length=Number(context.request.headers.get('content-length')||0);
 if(path.startsWith('/confirmar-presenca/')&&limited(rsvpBuckets,ip,30,60000))return new Response('Aguarde um minuto e tente novamente.',{status:429,headers:{'Retry-After':'60','Cache-Control':'no-store'}});
 if(path==='/admin/login'&&context.request.method==='POST'&&limited(loginBuckets,ip,10,15*60000))return new Response('Muitas tentativas. Aguarde 15 minutos.',{status:429,headers:{'Retry-After':'900','Cache-Control':'no-store'}});
 if(context.request.method==='POST'&&path.startsWith('/admin')&&length>2_500_000)return new Response('Arquivo ou formulário acima do limite permitido.',{status:413});
 if(context.request.method==='POST'&&(path.startsWith('/admin')||path.startsWith('/confirmar-presenca/'))&&context.request.headers.get('origin')!==context.url.origin)return new Response('Origem não permitida.',{status:403});
 if(path.startsWith('/admin')&&path!=='/admin/login'){
  const user=await getSession(context.cookies.get(SESSION_COOKIE)?.value).catch(()=>null);if(!user)return context.redirect('/admin/login?next='+encodeURIComponent(path),303);
  if(path.startsWith('/admin/usuarios')&&user.role!=='ADMIN')return new Response('Acesso restrito a administradores.',{status:403});
  (context.locals as any).admin=user;
 }
 const response=await next();response.headers.set('Referrer-Policy','same-origin');response.headers.set('X-Content-Type-Options','nosniff');response.headers.set('X-Frame-Options','DENY');response.headers.set('Cache-Control','no-store');if(path.startsWith('/admin')||path.startsWith('/confirmar-presenca/'))response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');return response;
});
