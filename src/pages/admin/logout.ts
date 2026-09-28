import type {APIRoute} from 'astro';
import {assertCsrf,destroySession,SESSION_COOKIE} from '../../lib/admin/auth';
export const POST:APIRoute=async({cookies,redirect,request,locals})=>{
 assertCsrf(await request.formData(),(locals as any).sessionToken);
 await destroySession(cookies.get(SESSION_COOKIE)?.value);
 cookies.delete(SESSION_COOKIE,{path:'/'});
 return redirect('/admin/login',303);
};
