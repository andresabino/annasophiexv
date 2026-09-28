import sharp from 'sharp';
for(const name of ['palazzo','venice-night','mask-detail','dress','suit']){
 const dest=name==='palazzo'?'public/images/anna/placeholder/palazzo':'public/images/'+name;
 for(const width of [640,960,1440])await sharp('assets/source/'+name+'.png').resize({width}).webp({quality:82}).toFile(dest+'-'+width+'.webp');
}
for(const width of [640,960,1440])await sharp('assets/source/anna-main.jpeg').rotate().resize({width,withoutEnlargement:false}).webp({quality:86}).toFile('public/images/anna/final/anna-main-'+width+'.webp');
await sharp('assets/source/anna-main.jpeg').rotate().resize(1200,630,{fit:'cover',position:'north'}).jpeg({quality:86}).toFile('public/images/og.jpg');
console.log('Imagens responsivas preparadas.');
