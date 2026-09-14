import {database,EVENT_SLUG} from './db';
type Category={name:string;slug:string;size?:string;items:{brand:string;url:string|null}[]};
const items=(values:[string,string|null][])=>values.map(([brand,url])=>({brand,url}));
export const giftCatalog:Category[]=[
{name:'Perfumaria',slug:'perfumaria',items:items([['Carolina Herrera','https://www.carolinaherrera.com/'],["Victoria’s Secret",'https://www.victoriassecret.com/'],['Bath & Body Works','https://www.bathandbodyworks.com/'],['Britney Spears','https://www.sephora.com.br/on/demandware.store/Sites-Sephora_BR-Site/pt_BR/Search-Show?isFilter=true&prefn1=brand&prefv1=B426'],['Prada','https://www.prada.com/'],['Dior','https://www.dior.com/']])},
{name:'Maquiagem',slug:'maquiagem',items:items([['Sephora','https://www.sephora.com.br/'],['Rare Beauty','https://www.rarebeauty.com/'],['Fenty Beauty','https://fentybeauty.com/'],['Océane','https://www.oceane.com.br/'],['Benefit','https://www.benefitcosmetics.com/'],['Lancôme','https://www.lancome.com.br/'],['Too Faced','https://www.toofaced.com/'],['Dior','https://www.dior.com/']])},
{name:'Tênis',slug:'tenis',size:'35',items:items([['Nike','https://www.nike.com.br/'],['Adidas','https://www.adidas.com.br/tenis'],['Veja','https://www.veja-store.com/'],['Puma','https://br.puma.com/'],['New Balance','https://www.newbalance.com.br/'],['Crocs','https://www.crocs.com.br/']])},
{name:'Roupas',slug:'roupas',size:'P / 36',items:items([['Zara','https://www.zara.com/br/'],['Bershka','https://www.bershka.com/br/women/clothes/tops-and-bodies-n3881.html'],['GAP','https://www.gap.com/'],['Youcom','https://www.youcom.com.br/']])},
{name:'Bolsas',slug:'bolsas',items:items([['Santa Lolla','https://www.santalolla.com.br/'],['Guess','https://www.guessbrasil.com.br/'],['Tommy Hilfiger','https://br.tommy.com/'],['Dior','https://www.dior.com/']])},
{name:'Óculos',slug:'oculos',items:items([["Levi’s",'https://www.levi.com.br/'],['Hugo Boss','https://www.hugoboss.com/'],['Carolina Herrera','https://www.carolinaherrera.com/'],['Chilli Beans','https://loja.chillibeans.com.br/'],['Miu Miu','https://www.miumiu.com/']])},
{name:'Bijuterias',slug:'bijuterias',items:items([['Vivara Life','https://www.vivara.com.br/'],['Pandora','https://br.pandora.net/pt/joias/'],['Rommanel','https://www.rommanel.com.br/'],['Swarovski','https://www.swarovski.com/']])}
];
export async function getGifts():Promise<Category[]>{
 if(!process.env.DATABASE_URL)return giftCatalog;
 const {rows}=await database().query('SELECT c.name,c.slug,g.brand,g.external_url,g.size FROM gift_categories c JOIN events e ON e.id=c.event_id JOIN gifts g ON g.category_id=c.id WHERE c.active AND g.active AND e.slug=$1 ORDER BY c.sort_order,g.sort_order',[EVENT_SLUG]);
 const categories=new Map<string,Category>();
 for(const row of rows){if(!categories.has(row.slug))categories.set(row.slug,{name:row.name,slug:row.slug,size:row.size,items:[]});categories.get(row.slug)!.items.push({brand:row.brand,url:row.external_url});}
 return [...categories.values()];
}