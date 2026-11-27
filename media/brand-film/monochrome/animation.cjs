// Vector titles and transitions around isolated CreatorBrain React components.
// Artwork is drawn on a 1280 x 720 grid and mastered at 1920 x 1080.
module.exports=function frame(c,t,images,W,H){
 const cuts=[0,5.5,12,17,23,29.5,36.5,43,50.5,55];
 let scene=0;while(scene<8&&t>=cuts[scene+1])scene++;
 const u=t-cuts[scene],dur=cuts[scene+1]-cuts[scene],k='#000',w='#fff';
 const bg=[k,w,k,w,k,w,k,w,k][scene],fg=bg===k?w:k;
 const clamp=x=>Math.max(0,Math.min(1,x)),move=(start,span=.66)=>1-(1-clamp((u-start)/span))**4;
 const scoped=fn=>{c.save();fn();c.restore()};
 function box(x,y,width,height,color){c.fillStyle=color;c.fillRect(x,y,width,height)}
 function stroke(x,y,width,height,color,l=2){c.strokeStyle=color;c.lineWidth=l;c.strokeRect(x,y,width,height)}
 function line(x,y,x2,y2,color,l=2){c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.lineWidth=l;c.strokeStyle=color;c.stroke()}
 function tx(v,x,y,z,col=fg,f='Arial',weight=700){c.fillStyle=col;c.font=weight+' '+z+'px '+f;c.textBaseline='alphabetic';c.fillText(v,x,y)}
 function code(v,x,y,z=15,col=fg){tx(v,x,y,z,col,'monospace',500)}
 function crop(x,y,width,height,fn){scoped(()=>{c.beginPath();c.rect(x,y,width,height);c.clip();fn()})}
 function words(v,x,y,z,start,col=fg){crop(x-4,y-z*1.12,1260-x,z*1.34,()=>tx(v,x,y+(z*1.4)*(1-move(start)),z,col))}
 function plate(name,x,y,width,top=0,portion=1){const im=images[name];const h=im.height*portion*width/im.width;c.drawImage(im,0,im.height*top,im.width,im.height*portion,x,y,width,h);return h}
 function paper(x,y,width,height,fn){box(x+9,y+9,width,height,fg);box(x,y,width,height,w);stroke(x,y,width,height,k,2);crop(x,y,width,height,fn)}
 function logo(x,y,z,ink=fg){box(x,y,z,z,ink);[.26,.44,.60].forEach((v,i)=>box(x+z*(.15+i*.244),y+z*(.79-v),z*.16,z*v,ink===k?w:k))}
 function pointer(x,y,p){scoped(()=>{c.translate(x,y);c.scale(p,p);c.beginPath();c.moveTo(0,0);c.lineTo(5,39);c.lineTo(14,29);c.lineTo(25,40);c.lineTo(32,34);c.lineTo(21,23);c.lineTo(36,18);c.closePath();c.fillStyle=k;c.fill();c.strokeStyle=w;c.lineWidth=2;c.stroke()})}
 function click(x,y,start){let a=clamp((u-start)/.48);if(a>0&&a<1){c.beginPath();c.arc(x,y,6+a*28,0,Math.PI*2);c.lineWidth=3*(1-a)+.5;c.strokeStyle=fg;c.stroke()}}
 function bread(x,y,scale,flat,ink){scoped(()=>{c.translate(x,y);c.scale(scale,scale*(flat?.55:1));let inv=ink===k?w:k;c.beginPath();c.moveTo(-156,24);c.bezierCurveTo(-161,-28,-103,-91,-19,-95);c.bezierCurveTo(55,-106,141,-71,160,8);c.bezierCurveTo(173,32,155,50,129,57);c.bezierCurveTo(55,76,-88,73,-144,51);c.closePath();c.fillStyle=ink;c.fill();
 c.beginPath();c.moveTo(-134,23);c.bezierCurveTo(-142,-12,-83,-75,-15,-77);c.bezierCurveTo(66,-89,124,-44,137,9);c.bezierCurveTo(147,41,77,49,-1,48);c.bezierCurveTo(-66,50,-125,44,-134,23);c.strokeStyle=inv;c.lineWidth=3.7;c.stroke();
 for(let j=0;j<5;j++)for(let i=0;i<10;i++){const a=i*26-115+Math.sin(j*18+i)*5,b=j*21-59+Math.sin(i*3)*5;if((a/124)**2+((b+9)/65)**2>.90)continue;const r=.5+.5*Math.sin(i*29+j*4);c.beginPath();c.ellipse(a,b,3+r*(flat?5:9),3+r*6,Math.sin(i*j),0,Math.PI*2);c.fillStyle=inv;c.fill()}})}
 c.save();c.scale(W/1280,H/720);box(0,0,1280,720,bg);
 const route=['','Library','Library','Content Studio','Studio agent','Content Studio','Agents','Link in bio',''][scene];
 if(scene!==8){logo(44,31,27);tx('CreatorBrain',82,53,22);if(route){line(240,34,228,56,fg,1.5);tx(route,254,52,19,fg,'Arial',500)}code('creatorbrain.tech',1060,52,17);line(44,75,1236,75,fg,1);}
 if(scene===0){
  words('Same dough.',48,220,115,.05);words('Different loaves.',48,337,115,.24);
  let p=move(.36,.95);bread(483-64*(1-p),464+120*(1-p),.88,true,w);bread(845+64*(1-p),469+120*(1-p),.88,false,w);
  line(302,544,1032,544,w,2);code('A   /   LOOSE SHAPING',322,574,17);code('B   /   TIGHT SHAPING',713,574,17);
  words('How does a baker turn this experiment into a Short?',52,655,38,1.10);
 } else if(scene===1){
  code('CHANNEL STUDY',48,131,17);words('Start with the original video.',45,227,76,.04);
  const x=78+42*(1-move(.32)),y=293+40*(1-move(.32));paper(x,y,1125,235,()=>plate('transcript',x,y,1125));
  const v=move(1.55,1.5);box(218,397,487*v,3,k);
  tx('CreatorBrain reads the title, description and available transcript.',52,633,29,k,'Arial',500);
 } else if(scene===2){
  words('What makes the opening work?',49,192,72,.06);
  const x=88,y=265+65*(1-move(.19));paper(x,y,1104,199,()=>plate('hook',x+15,y+15,1074));
  code('FROM THE LIBRARY',90,499,15);
  words('A question you can answer on screen.',85,588,53,1.1);
 } else if(scene===3){
  code('THE NEXT PROJECT',48,178,17);words('Show the',44,281,84,.03);words('shaping.',44,367,84,.20);
  tx('Give Studio the comparison',49,457,28,k,'Arial',500);tx('you want viewers to see.',49,494,28,k,'Arial',500);
  const x=578+75*(1-move(.23)),y=144;paper(x,y,625,466,()=>plate('new',x,y,625));
  let p=move(1.8,1.4);pointer(1150-62*p,663-106*p,1.03);click(1088,557,3.15);
 } else if(scene===4){
  code('STUDIO AGENT',52,147,17);words('Ask for the cut you need.',49,248,84,.02);
  const x=87,y=326;paper(x,y,1107,222,()=>{plate('suggest',x+8,y+12,1090);crop(x+8,y+90,1090*move(1.27,.82),132,()=>plate('prompt',x+8,y+90,1090))});
  let p=move(.32,.96),q=move(3.2,1.15);pointer(675-296*p+750*q,446-58*p+105*q,1.02);click(379,388,1.29);click(1129,493,4.36);
  tx('One request drafts a Short using the project brief and your past work.',52,637,29,w,'Arial',500);
 } else if(scene===5){
  words('Read it.',44,232,85,.03);words('Edit it.',44,320,85,.18);words('Export it.',44,408,85,.33);
  const x=435,y=117+28*(1-move(.22)),ww=788;paper(x,y,ww,481,()=>{const ht=plate('asset-tabs',x,y,ww);plate('script',x,y+ht,ww,0,.625)});
  plate('export',49,489,238);pointer(244-32*move(2,1),602-75*move(2,1),1);click(212,527,3.08);
  tx('The script, titles and captions stay with the video project.',50,650,27,k,'Arial',500);
 } else if(scene===6){
  code('REUSABLE AGENTS',49,161,17);words('Study another',45,263,70,.03);words('baker’s hooks.',45,339,70,.20);
  tx('Save a competitor study with one',49,434,27,w,'Arial',500);tx('channel and one question.',49,470,27,w,'Arial',500);
  const x=690+75*(1-move(.18)),y=117;paper(x,y,491,474,()=>plate('agent',x+7,y+7,477));
  code('/run Bread openings',51,555,24);
 } else if(scene===7){
  words('Put the basket',46,211,73,.02);words('beside the bake.',46,293,73,.18);
  tx('Connect Amazon Associates to look up',51,375,26,k,'Arial',500);tx('a tagged link. Add it to your bio page.',51,411,26,k,'Arial',500);
  paper(49,475,691,98,()=>plate('affiliate',53,482,682));
  const x=856,y=106+35*(1-move(.16));box(x-7,y-7,272,545,k);plate('bio',x,y,258);
 } else {
  const p=move(.18);logo(218,232+40*(1-p),111,w);words('CreatorBrain',354,328,108,.13);
  words('Your channel is the starting point.',239,424,52,.54);
  const v=move(1.05);crop(437,484,425*v,77,()=>{box(437,484,425,77,w);tx('creatorbrain.tech',474,535,42,k)});
 }
 if(scene>0&&scene<8){for(let i=0;i<7;i++)box(45+i*171,697,i<scene-1?157:i===scene-1?157*clamp(u/dur):0,3,fg)}
 if(scene<8&&u>dur-.29){const a=clamp((u-dur+.29)/.29);box(1280*(1-a),0,1280*a+1,720,fg)}
 c.restore();
}
