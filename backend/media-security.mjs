const MAX_IMAGE_PIXELS = 40_000_000;
const MAX_IMAGE_DIMENSION = 10_000;

function dimensionsAllowed(width, height) {
  return Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0
    && width <= MAX_IMAGE_DIMENSION && height <= MAX_IMAGE_DIMENSION && width * height <= MAX_IMAGE_PIXELS;
}

function jpeg(buffer) {
  const chunks=[buffer.subarray(0,2)];
  let offset=2,width=0,height=0;
  const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
  while(offset+4<=buffer.length&&buffer[offset]===0xff){
    const marker=buffer[offset+1];
    if(marker===0xda||marker===0xd9){chunks.push(buffer.subarray(offset));break;}
    const length=buffer.readUInt16BE(offset+2);
    if(length<2||offset+2+length>buffer.length)throw new Error('Imagem JPEG inválida.');
    if(sof.has(marker)&&length>=7){height=buffer.readUInt16BE(offset+5);width=buffer.readUInt16BE(offset+7);}
    if(![0xe1,0xed,0xfe].includes(marker))chunks.push(buffer.subarray(offset,offset+2+length));
    offset+=2+length;
  }
  return {buffer:Buffer.concat(chunks),width,height};
}

function png(buffer) {
  const width=buffer.readUInt32BE(16),height=buffer.readUInt32BE(20),chunks=[buffer.subarray(0,8)];
  let offset=8;
  while(offset+12<=buffer.length){
    const length=buffer.readUInt32BE(offset),end=offset+12+length;
    if(end>buffer.length)throw new Error('Imagem PNG inválida.');
    const type=buffer.subarray(offset+4,offset+8).toString('ascii');
    if(!['eXIf','tEXt','iTXt','zTXt'].includes(type))chunks.push(buffer.subarray(offset,end));
    offset=end;
    if(type==='IEND')break;
  }
  return {buffer:Buffer.concat(chunks),width,height};
}

function webp(buffer) {
  const chunks=[];let offset=12,width=0,height=0;
  while(offset+8<=buffer.length){
    const type=buffer.subarray(offset,offset+4).toString('ascii'),length=buffer.readUInt32LE(offset+4);
    const data=offset+8,end=data+length+(length%2);
    if(end>buffer.length)throw new Error('Imagem WEBP inválida.');
    if(type==='VP8X'&&length>=10){width=1+buffer[data+4]+(buffer[data+5]<<8)+(buffer[data+6]<<16);height=1+buffer[data+7]+(buffer[data+8]<<8)+(buffer[data+9]<<16);}
    if(type==='VP8 '&&length>=10&&buffer[data+3]===0x9d&&buffer[data+4]===0x01&&buffer[data+5]===0x2a){width=buffer.readUInt16LE(data+6)&0x3fff;height=buffer.readUInt16LE(data+8)&0x3fff;}
    if(type==='VP8L'&&length>=5&&buffer[data]===0x2f){const bits=buffer.readUInt32LE(data+1);width=(bits&0x3fff)+1;height=((bits>>>14)&0x3fff)+1;}
    if(!['EXIF','XMP '].includes(type))chunks.push(buffer.subarray(offset,end));
    offset=end;
  }
  const body=Buffer.concat(chunks),header=Buffer.from(buffer.subarray(0,12));header.writeUInt32LE(body.length+4,4);
  return {buffer:Buffer.concat([header,body]),width,height};
}

export function sanitizeImageBuffer(buffer,mimeType){
  let result;
  if(mimeType==='image/jpeg')result=jpeg(buffer);
  else if(mimeType==='image/png')result=png(buffer);
  else if(mimeType==='image/webp')result=webp(buffer);
  else return {error:'Tipo de imagem não suportado.'};
  if(!dimensionsAllowed(result.width,result.height))return {error:'A imagem possui dimensões inválidas ou excede 40 megapixels.'};
  return result;
}

export function unsafePdfReason(buffer){
  const source=buffer.toString('latin1');
  if(/\/(?:JavaScript|JS|OpenAction|Launch|EmbeddedFile|RichMedia|XFA)\b/i.test(source))return 'O PDF contém recursos ativos ou arquivos incorporados e não pode ser enviado.';
  return '';
}
