let deferredInstall=null;
if('serviceWorker'in navigator){
 addEventListener('load',()=>navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{}),{once:true});
}
addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;document.documentElement.dataset.installable='1';});
addEventListener('appinstalled',()=>{deferredInstall=null;delete document.documentElement.dataset.installable;});
export async function installXanhArcade(){if(!deferredInstall)return false;deferredInstall.prompt();const result=await deferredInstall.userChoice;deferredInstall=null;return result.outcome==='accepted';}
