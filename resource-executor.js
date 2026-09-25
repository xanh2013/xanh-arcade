// Dedicated CPU worker: never run donated computation on the rendering thread.
export function createResourceExecutor({WorkerClass=globalThis.Worker,timeoutMs=2000}={}){
 let worker=null,nextId=0;const pending=new Map();
 function close(){worker?.terminate();worker=null;for(const job of pending.values()){clearTimeout(job.timer);job.reject(Error('Tác vụ đã dừng.'));}pending.clear();}
 return {run(task){if(!WorkerClass)return Promise.reject(Error('Trình duyệt không hỗ trợ Worker.'));if(pending.size>=2)return Promise.reject(Error('Thiết bị đang bận.'));
  if(!worker){worker=new WorkerClass(new URL('./resource-worker.js',import.meta.url),{type:'module'});worker.onmessage=({data})=>{const job=pending.get(data.id);if(!job)return;pending.delete(data.id);clearTimeout(job.timer);if(data.error)job.reject(Error(data.error));else job.resolve({result:data.result,cpuMs:data.cpuMs});};worker.onerror=close;}
  return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(close,timeoutMs);pending.set(id,{resolve,reject,timer});try{worker.postMessage({id,task});}catch(error){close();}});
 },close};
}
