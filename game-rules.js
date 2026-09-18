// Shared, deterministic rules. Five or more consecutive stones wins (open-ended caro).
export function winningLine(board,index){
 const piece=board[index]; if(!piece)return [];
 const row=Math.floor(index/15),col=index%15;
 for(const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]){
  const line=[index];
  for(const sign of [-1,1])for(let step=1;step<15;step++){
   const r=row+dr*step*sign,c=col+dc*step*sign;
   if(r<0||r>=15||c<0||c>=15||board[r*15+c]!==piece)break;
   line.push(r*15+c);
  }
  if(line.length>=5)return line;
 }return [];
}
export function overlaps(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
export function brickHit(ball,brick){const x=Math.max(brick.x,Math.min(ball.x,brick.x+brick.w)),y=Math.max(brick.y,Math.min(ball.y,brick.y+brick.h));return (ball.x-x)**2+(ball.y-y)**2<=ball.r**2;}
