import test from 'node:test';
import assert from 'node:assert/strict';
import {moveBannerCrop} from '../shared/banner-crop.mjs';
test('recorte do banner acompanha arrasto sem permitir bordas vazias',()=>{
  const image={width:1200,height:800},frame={width:640,height:100};
  const crop={x:50,y:50,zoom:100};
  const moved=moveBannerCrop(crop,{x:100,y:40},image,frame);
  assert.equal(moved.x,50);assert.ok(moved.y<50);
  assert.equal(moveBannerCrop(crop,{x:0,y:9999},image,frame).y,0);
  assert.equal(moveBannerCrop(crop,{x:0,y:-9999},image,frame).y,100);
  assert.ok(moveBannerCrop({...crop,zoom:200},{x:50,y:0},image,frame).x<50);
  assert.deepEqual(moveBannerCrop(crop,{x:10,y:10},{width:0,height:0},frame),crop);
});
