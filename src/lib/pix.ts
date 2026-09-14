import QRCode from 'qrcode';
function field(id:string,value:string){return id+String(Buffer.byteLength(value)).padStart(2,'0')+value}
export function crc16(value:string){let crc=0xffff;for(const byte of Buffer.from(value)){crc^=byte<<8;for(let bit=0;bit<8;bit++)crc=((crc&0x8000)?(crc<<1)^0x1021:crc<<1)&0xffff;}return crc.toString(16).toUpperCase().padStart(4,'0')}
const clean=(value:string,length:number)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,'').slice(0,length);
export function pixPayload(key:string,name:string,city:string){
 const value=field('00','01')+field('26',field('00','br.gov.bcb.pix')+field('01',key))+field('52','0000')+field('53','986')+field('58','BR')+field('59',clean(name,25))+field('60',clean(city,15))+field('62',field('05','***'))+'6304';
 return value+crc16(value);
}
export async function pixDetails(){
 const key=process.env.PIX_KEY?.trim(),name=process.env.PIX_RECIPIENT_NAME?.trim(),type=process.env.PIX_KEY_TYPE;
 if(!key||!name||!type||Buffer.byteLength(key)>77)return null;
 const city=process.env.PIX_RECIPIENT_CITY||'OSASCO';
 const payload=pixPayload(key,name,city);
 return {key,name,type,payload,qr:await QRCode.toDataURL(payload,{width:256,margin:2})};
}