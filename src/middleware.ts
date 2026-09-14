import {defineMiddleware} from 'astro:middleware';
const buckets=new Map<string,{count:number;reset:number}>();
export const onRequest=defineMiddleware(async(context,next)=>{
  if(context.url.pathname.startsWith('/confirmar-presenca/')){
    const now=Date.now();
    for(const [key,value] of buckets) if(value.reset<now) buckets.delete(key);
    let ip='local';try{ip=context.clientAddress}catch{}
    const bucket=buckets.get(ip)||{count:0,reset:now+60000};
    bucket.count++;buckets.set(ip,bucket);
    if(bucket.count>30||buckets.size>10000) return new Response('Aguarde um minuto e tente novamente.',{status:429,headers:{'Retry-After':'60','Cache-Control':'no-store'}});
    if(context.request.method==='POST'&&context.request.headers.get('origin')!==context.url.origin) return new Response('Origem não permitida.',{status:403});
  }
  const response=await next();
  response.headers.set('Referrer-Policy','same-origin');
  response.headers.set('X-Content-Type-Options','nosniff');
  response.headers.set('X-Frame-Options','DENY');
  response.headers.set('Cache-Control','no-store');
  if(context.url.pathname.startsWith('/confirmar-presenca/')) response.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
  return response;
});
