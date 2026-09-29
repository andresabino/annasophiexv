import path from 'node:path';
import {mkdir,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sourceDir=path.join(root,'public','images','anna','final','ensaio');
const outputDir=path.join(root,'public','images','anna','final','curated');
const galleryDir=path.join(root,'public','images','anna','final','gallery');
const widths=[640,960,1440];
await Promise.all([mkdir(outputDir,{recursive:true}),mkdir(galleryDir,{recursive:true})]);

const crops=[
 {name:'hero-desktop',source:'00016.jpg',ratio:16/9,position:'center'},
 {name:'hero-mobile',source:'00013.jpg',ratio:9/16},
 {name:'palazzo-desktop',source:'00013.jpg',ratio:6/5,position:'center'},
 {name:'palazzo-mobile',source:'00013.jpg',ratio:4/5},
 {name:'save-date-desktop',source:'0008.jpg',ratio:4/5,position:'south'},
 {name:'save-date-mobile',source:'0008.jpg',ratio:3/4,position:'south'},
 {name:'editorial-desktop',source:'00015.jpg',ratio:4/5},
 {name:'editorial-mobile',source:'00015.jpg',ratio:3/4},
 {name:'gallery-feature-desktop',source:'00010.jpg',ratio:4/5},
 {name:'gallery-feature-mobile',source:'00010.jpg',ratio:1},
];

await Promise.all(crops.flatMap(crop=>widths.flatMap(width=>{
 const height=Math.round(width/crop.ratio),input=path.join(sourceDir,crop.source),base=path.join(outputDir,`${crop.name}-${width}`);
 const pipeline=()=>sharp(input).rotate().resize({width,height,fit:'cover',position:crop.position??'attention'}).sharpen({sigma:.65});
 return[pipeline().webp({quality:82,smartSubsample:true}).toFile(`${base}.webp`),pipeline().avif({quality:58,effort:6,chromaSubsampling:'4:4:4'}).toFile(`${base}.avif`)];
})));

const originals=(await readdir(sourceDir)).filter(file=>/\.jpg$/i.test(file));
await Promise.all(originals.map(file=>sharp(path.join(sourceDir,file)).rotate().resize(640,640,{fit:'cover',position:'attention'}).webp({quality:80}).toFile(path.join(galleryDir,file.replace('.jpg','-640.webp')))));
await sharp(path.join(sourceDir,'00016.jpg')).rotate().resize(1200,630,{fit:'cover',position:'center'}).jpeg({quality:86}).toFile(path.join(root,'public','images','og.jpg'));
console.log(`Generated ${crops.length*widths.length*2} curated images, ${originals.length} gallery thumbnails and Open Graph.`);
