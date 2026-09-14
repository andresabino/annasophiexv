import {database,EVENT_SLUG} from './db';
export async function getPhotos(){
 if(!process.env.DATABASE_URL)return [];
 const {rows}=await database().query('SELECT p.title,p.image_url,p.thumbnail_url,a.name album,a.slug FROM photos p JOIN photo_albums a ON a.id=p.album_id JOIN events e ON e.id=a.event_id WHERE p.active AND a.active AND e.slug=$1 ORDER BY a.sort_order,p.sort_order,p.id',[EVENT_SLUG]);
 return rows as {title:string;image_url:string;thumbnail_url:string;album:string;slug:string}[];
}