'use strict';
const { GameNode, Shapes, ShapeUtils } = require('squish-150');
const palette = { ink:[24,38,50,255], muted:[95,116,125,255], cream:[247,241,220,255], white:[255,253,242,255],
    coral:[237,110,84,255], gold:[244,193,81,255], mint:[120,201,163,255], blue:[94,157,199,255], navy:[30,55,66,255] };
const clamp = (v,a,b) => Math.max(a, Math.min(b, Number(v)||0));
const circle = (x,y,r,n=16) => Array.from({length:n+1},(_,i)=>[x+Math.cos(i/n*Math.PI*2)*r,y+Math.sin(i/n*Math.PI*2)*r]);
const line = (x,y,tx,ty,width=1) => { const a=Math.atan2(ty-y,tx-x),dx=Math.sin(a)*width/2,dy=Math.cos(a)*width/2;return [[x-dx,y+dy],[tx-dx,ty+dy],[tx+dx,ty-dy],[x+dx,y-dy],[x-dx,y+dy]]; };
class UI {
    constructor(root){this.root=root;}
    shape(points,fill,parent=this.root,extra={}){const node=new GameNode.Shape({shapeType:Shapes.POLYGON,coordinates2d:points,fill,...extra});parent.addChild(node);return node;}
    rect(x,y,w,h,fill,parent=this.root,extra={}){return this.shape(ShapeUtils.rectangle(x,y,w,h),fill,parent,extra);}
    group(parent=this.root,ids){return this.rect(0,0,0,0,null,parent,ids?{playerIds:ids}:{});}
    text(value,x,y,size=3,color=palette.ink,parent=this.root,align='left'){const node=new GameNode.Text({textInfo:{text:String(value),x,y,size,color,align,font:'default'}});parent.addChild(node);return node;}
    button(label,x,y,w,h,action,fill=palette.ink,parent=this.root){const node=this.rect(x,y,w,h,fill,parent,{onClick:action});this.text(label,x+w/2,y+h/2-1.25,2.5,fill===palette.ink||fill===palette.navy?palette.white:palette.ink,node,'center');return node;}
    updateText(node,value){if(node.node.text.text!==String(value)){node.node.text.text=String(value);node.node.onStateChange();}}
    move(node,x,y,w,h,fill){node.update({coordinates2d:ShapeUtils.rectangle(x,y,w,h),...(fill?{fill}:{})});}
    ball(node,x,y,r,fill){node.update({coordinates2d:circle(x,y,r),...(fill?{fill}:{})});}
    hide(node){this.move(node,0,0,0,0);}
}
module.exports={UI,C:palette,clamp,circle,line};
