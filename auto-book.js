'use strict';
// Prueba interna autenticada: el usuario simula al cliente; NO es un webhook público.
const BASE=(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
const KEY=process.env.SUPABASE_ANON_KEY||'';
const {localToUTC,parseHours}=require('./availability');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const send=(res,status,data)=>res.status(status).json(data);
async function db(path,token,method='GET',body){
 const r=await fetch(BASE+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+token,'Content-Type':'application/json',Prefer:'return=representation'},...(body?{body:JSON.stringify(body)}:{})});
 const data=await r.json().catch(()=>null);
 if(!r.ok){const e=Error(data?.message||'Error de base de datos');e.status=r.status;e.code=data?.code;throw e}
 return data;
}
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return send(res,405,{error:'Usa POST.'});
 if(!BASE||!KEY)return send(res,503,{error:'Supabase no configurado.'});
 const token=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1];
 if(!token||token.length>4096)return send(res,401,{error:'Inicia sesión.'});
 const b=typeof req.body==='string'?(()=>{try{return JSON.parse(req.body)}catch{return null}})():req.body;
 if(!b||!UUID.test(b.businessId||'')||typeof b.clientName!=='string'||!b.clientName.trim()||b.clientName.length>100||typeof b.service!=='string'||!b.service.trim()||b.service.length>100||!/^\d{4}-\d{2}-\d{2}$/.test(b.date||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(b.time||'')||!Number.isInteger(b.duration)||b.duration<15||b.duration>480||typeof b.resource!=='string'||!b.resource.trim()||b.resource.length>80||b.confirmed!==true)return send(res,400,{error:'Completa los datos y confirma expresamente la solicitud.'});
 try{
  const user=await db('/auth/v1/user',token);
  if(!user?.id)return send(res,401,{error:'Sesión inválida.'});
  const businesses=await db('/rest/v1/nexora_businesses?id=eq.'+encodeURIComponent(b.businessId)+'&owner_id=eq.'+encodeURIComponent(user.id)+'&select=id,timezone,opening_hours',token);
  if(businesses.length!==1)return send(res,403,{error:'Negocio no autorizado.'});
  const business=businesses[0],tz=business.timezone||'UTC';
  new Intl.DateTimeFormat('en-US',{timeZone:tz});
  const open=parseHours(business.opening_hours||'',b.date,b.time,b.duration);
  if(!open.valid)return send(res,409,{error:open.reason});
  const start=localToUTC(b.date,b.time,tz);
  if(start.getTime()<=Date.now())return send(res,409,{error:'Selecciona una hora futura.'});
  // Buscar cliente existente por nombre; la simulación no recibe datos sensibles adicionales.
  const found=await db('/rest/v1/nexora_clients?business_id=eq.'+encodeURIComponent(b.businessId)+'&name=eq.'+encodeURIComponent(b.clientName.trim())+'&select=id&limit=1',token);
  let clientId=found[0]?.id,created=false;
  if(!clientId){const c=await db('/rest/v1/nexora_clients',token,'POST',{business_id:b.businessId,name:b.clientName.trim()});clientId=c[0].id;created=true}
  try{
   // La restricción EXCLUDE de setup-business.sql impide dobles reservas incluso con solicitudes simultáneas.
   const rows=await db('/rest/v1/nexora_bookings',token,'POST',{business_id:b.businessId,client_id:clientId,service:b.service.trim(),start_at:start.toISOString(),duration_minutes:b.duration,resource:b.resource.trim()});
   return send(res,201,{ok:true,bookingId:rows[0].id,startAt:rows[0].start_at,clientId});
  }catch(err){
   if(created)await db('/rest/v1/nexora_clients?id=eq.'+encodeURIComponent(clientId)+'&business_id=eq.'+encodeURIComponent(b.businessId),token,'DELETE').catch(()=>{});
   if(err.code==='23P01')return send(res,409,{error:'El horario acaba de ocuparse. Elige otro.'});
   throw err;
  }
 }catch(err){console.error('Auto-book:',err.code||err.status||err.message);return send(res,err.status===401?401:500,{error:'No se pudo guardar la reserva. Comprueba el horario y la configuración.'})}
};
