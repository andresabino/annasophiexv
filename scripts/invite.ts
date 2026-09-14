import {database,EVENT_SLUG} from '../src/lib/db';
import {generateToken,hashToken} from '../src/lib/tokens';
const [name,capacity,type='family']=process.argv.slice(2);
const max=Number(capacity);
if(!name||name.length>120||!Number.isInteger(max)||max<1||max>100||!['individual','couple','family','group'].includes(type)) throw new Error('Uso: npm run invite -- "Família Exemplo" 4 family');
const token=generateToken();
try{await database().query('INSERT INTO invitations(event_id,display_name,type,token_hash,max_guests) SELECT id,$1,$2,$3,$4 FROM events WHERE slug=$5',[name,type,hashToken(token),max,EVENT_SLUG]);
console.log((process.env.PUBLIC_SITE_URL||'http://localhost:4321').replace(/\/$/,'')+'/confirmar-presenca/'+token);
}finally{await database().end();}