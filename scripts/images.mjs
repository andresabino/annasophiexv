import sharp from 'sharp';
for(const name of ['palazzo','venice-night','mask-detail','dress','suit']){
 const dest=name==='palazzo'?'public/images/anna/placeholder/palazzo':'public/images/'+name;
 for(const width of [640,960,1440])await sharp('assets/source/'+name+'.png').resize({width}).webp({quality:82}).toFile(dest+'-'+width+'.webp');
}
console.log('Imagens decorativas responsivas preparadas. Execute npm run media:curate para processar o ensaio oficial.');
