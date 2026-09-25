import {createResourceExecutor} from './resource-executor.js';
import {detectResourceCapabilities} from './resource-sharing.js';
export function createAdminDonor(api,onState){
 let running=false,generation=0,timer=null,rtt=0,first=true,usage={cpuMs:0,bytes:0,tasks:0};
 const worker=createResourceExecutor(),encoder=new TextEncoder();
 async function poll(g){if(!running||g!==generation)return;const sample=usage;usage={cpuMs:0,bytes:0,tasks:0};const start=performance.now();
  try{const result=await api('shooter/admin-resource-donor',{enabled:true,start:first,capabilities:detectResourceCapabilities(),rtt,usage:sample});rtt=performance.now()-start;if(!running||g!==generation)return;first=false;
   if(!result.enabled){stop(false);onState('Hệ thống đã tắt chia sẻ.',false);return;}
   if(result.task){onState('Đang hỗ trợ tìm đường cho bot · '+result.matches+' trận.',true);usage.bytes+=encoder.encode(JSON.stringify(result.task)).length;const computed=await worker.run(result.task);if(!running||g!==generation)return;usage.cpuMs+=computed.cpuMs;usage.tasks++;usage.bytes+=encoder.encode(JSON.stringify(computed.result)).length;await api('shooter/admin-resource-result',{matchId:result.task.matchId,taskId:result.task.taskId,result:computed.result});}
   else onState(result.matches?'Sẵn sàng · Chờ tác vụ phù hợp.':'Đã kết nối · Chờ trận online bắt đầu.',true);
  }catch(error){if(!running||g!==generation)return;if(error.status===401||error.status===403){stop(false);onState('Phiên admin đã hết hạn. Đăng nhập lại để chia sẻ.',false);return;}onState('Đang nối lại: '+error.message,true);}
  finally{if(running&&g===generation)timer=setTimeout(()=>poll(g),Math.max(150,1000-(performance.now()-start)));}
 }
 function stop(notify=true){running=false;generation++;clearTimeout(timer);worker.close();usage={cpuMs:0,bytes:0,tasks:0};if(notify)api('shooter/admin-resource-donor',{enabled:false}).catch(()=>{});onState('Đã dừng chia sẻ CPU máy này.',false);}
 return {start(){if(running)return;if(typeof Worker==='undefined'){onState('Trình duyệt chưa hỗ trợ Worker.',false);return;}running=true;first=true;generation++;onState('Đang kết nối CPU máy này…',true);poll(generation);},stop};
}
