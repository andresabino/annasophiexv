export class PayloadTooLarge extends Error {}
export async function limitedForm(request:Request,limit=16000){
 if(Number(request.headers.get('content-length')||0)>limit)throw new PayloadTooLarge();
 const reader=request.body?.getReader();if(!reader)return new URLSearchParams();
 let size=0;const chunks:Uint8Array[]=[];
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new PayloadTooLarge()}chunks.push(value)}
 const combined=new Uint8Array(size);let offset=0;for(const chunk of chunks){combined.set(chunk,offset);offset+=chunk.byteLength}
 return new URLSearchParams(new TextDecoder().decode(combined));
}