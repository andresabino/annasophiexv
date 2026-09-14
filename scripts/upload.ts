import sharp from 'sharp';
import {uploadPhoto} from '../src/lib/storage';
import {database,EVENT_SLUG} from '../src/lib/db';
const [path,albumSlug,title='Anna Sophie']=process.argv.slice(2);
if(!path||!albumSlug) throw new Error('Uso: npm run media:upload -- arquivo.jpg anna-sophie "Título"');
try{
 const album=(await database().query('SELECT a.id FROM photo_albums a JOIN events e ON e.id=a.event_id WHERE a.slug=$1 AND e.slug=$2',[albumSlug,EVENT_SLUG])).rows[0];
 if(!album)throw new Error('Álbum não encontrado.');
 const source=sharp(path).rotate();
 const full=await uploadPhoto(await source.clone().resize({width:2000,withoutEnlargement:true}).webp({quality:85}).toBuffer(),'webp');
 const thumb=await uploadPhoto(await source.clone().resize({width:600,withoutEnlargement:true}).webp({quality:78}).toBuffer(),'webp');
 await database().query('INSERT INTO photos(album_id,title,image_url,thumbnail_url) VALUES($1,$2,$3,$4)',[album.id,title,full,thumb]);
 console.log('Foto adicionada ao álbum.');
}finally{await database().end();}