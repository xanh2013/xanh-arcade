// HTTPS cookies on any production host, with local HTTP development preserved.
export function secureCookies(env=process.env){
 return env.SECURE_COOKIES==='true'||env.NODE_ENV==='production'||Boolean(env.RENDER)||Boolean(env.KOYEB_SERVICE_ID);
}
