export function moveBannerCrop(crop, delta, image, frame) {
  if (!image.width || !image.height || !frame.width || !frame.height) return crop;
  const scale = Math.max(frame.width / image.width, frame.height / image.height) * crop.zoom / 100;
  const move=(position,distance,overflow)=>overflow>0.5?Math.min(100,Math.max(0,position-distance/overflow*100)):50;
  return {...crop,x:move(crop.x,delta.x,image.width*scale-frame.width),y:move(crop.y,delta.y,image.height*scale-frame.height)};
}
