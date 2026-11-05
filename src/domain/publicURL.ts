const secret=/password|authorization|cookie|api[_-]?key|token|credential|secret|rawscript/i;
export const safePublicURL=(value:string)=>{try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password&&![...url.searchParams.keys()].some(key=>secret.test(key)||['u','p','t','s'].includes(key));}catch{return false;}};
