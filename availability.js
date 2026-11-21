 'use strict';
const BASE=(process.env.SUPABASE_URL||'').replace(/\/+$/,'');
const KEY=process.env.SUPABASE_ANON_KEY||'';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const respond=(res,code,data)=>res.status(code).json(data);
async function get(path,token){const r=await fetch(BASE+path,{headers:{apikey:KEY,Authorization:'Bearer '+token}});const data=await r.json().catch(()=>null);if(!r.ok)throw Error('No se pudieron consultar los datos del negocio.');return data}
function localParts(date,tz){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`}
function localToUTC(date,time,tz){const wanted=`${date}T${time}`;let stamp=Date.parse(wanted+':00Z');if(!Number.isFinite(stamp))throw Error('Fecha inválida.');for(let i=0;i<4;i++){const actual=localParts(new Date(stamp),tz);const diff=Date.parse(wanted+':00Z')-Date.parse(actual+':00Z');stamp+=diff;if(!diff)break}if(localParts(new Date(stamp),tz)!==wanted)throw Error('Esa hora no existe en la zona horaria del negocio.');return new Date(stamp)}
const dayNames=['dom','lun','mar','mie','jue','vie','sab'];
function parseHours(text,date,time,duration){
  if(typeof text!=='string'||!text.trim())return {valid:false,reason:'Configura el horario de atención del negocio antes de ofrecer reservas.'};
  const parsedDate=new Date(date+'T12:00:00Z');
  if(!Number.isFinite(parsedDate.getTime())||parsedDate.toISOString().slice(0,10)!==date)return {valid:false,reason:'La fecha de la reserva no es válida.'};
  const day=parsedDate.getUTCDay();
  const normalized=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  const fragments=normalized.split(/[;\n]+/);
  let recognized=false,appliesToday=false;
  for(const fragment of fragments){
    // Acepta 9-18, 9:00-18:00, 09:00 a 18:00 y "de 9 a 18".
    const m=fragment.match(/(?:^|\D)(\d{1,2})(?::([0-5]\d))?\s*(?:-|–|—|\ba\b|\bhasta\b)\s*(\d{1,2})(?::([0-5]\d))?(?=\D|$)/);
    if(!m)continue;
    const startHour=Number(m[1]),endHour=Number(m[3]);
    if(startHour>23||endHour>24||endHour===24&&Number(m[4]||0)!==0)continue;
    recognized=true;
    const label=fragment.slice(0,m.index).trim();
    const hasDay=/(lun|mar|mie|jue|vie|sab|dom)/.test(label);
    let applies=!hasDay||/todos|diario|cada dia|todos los dias/.test(label);
    const dayMatches=[...label.matchAll(/lun(?:es)?|mar(?:tes)?|mie(?:rcoles)?|jue(?:ves)?|vie(?:rnes)?|sab(?:ado)?|dom(?:ingo)?/g)].map(x=>dayNames.findIndex(d=>x[0].startsWith(d)));
    if(dayMatches.length>=2&&/\b(?:a|hasta|al)\b/.test(label)){
      const first=dayMatches[0],last=dayMatches[1];
      applies=applies||(first<=last?day>=first&&day<=last:day>=first||day<=last);
    }else if(dayMatches.includes(day))applies=true;
    if(!applies)continue;
    appliesToday=true;
    const start=startHour*60+Number(m[2]||0),end=endHour*60+Number(m[4]||0);
    const requested=Number(time.slice(0,2))*60+Number(time.slice(3));
    if(end>start&&requested>=start&&requested+duration<=end)return {valid:true};
  }
  if(!recognized)return {valid:false,reason:'No se pudo interpretar el horario del negocio. Usa, por ejemplo: lunes a viernes de 09:00 a 18:00.'};
  if(!appliesToday)return {valid:false,reason:'El negocio está cerrado el día seleccionado.'};
  return {valid:false,reason:'La cita está fuera del horario de atención o termina después del cierre.'};
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return respond(res,405,{error:'Utiliza POST.'});
  if(!BASE||!KEY)return respond(res,503,{error:'Supabase no está configurado.'});
  const token=/^Bearer (.+)$/i.exec(req.headers.authorization||'')?.[1];if(!token||token.length>4096)return respond(res,401,{error:'Inicia sesión.'});
  try{
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
    const {businessId,date,time,resource,duration}=body;
    if(!UUID.test(businessId||'')||!/^(20\d{2})-(\d{2})-(\d{2})$/.test(date||'')||!/^([01]\d|2[0-3]):[0-5]\d$/.test(time||'')||typeof resource!=='string'||!resource.trim()||resource.length>80||!Number.isInteger(duration)||duration<15||duration>480)return respond(res,400,{error:'Datos de cita inválidos.'});
    const user=await get('/auth/v1/user',token);if(!user?.id)return respond(res,401,{error:'Sesión inválida.'});
    const bs=await get('/rest/v1/nexora_businesses?id=eq.'+encodeURIComponent(businessId)+'&owner_id=eq.'+encodeURIComponent(user.id)+'&select=id,timezone,opening_hours',token);
    if(bs.length!==1)return respond(res,403,{error:'Negocio no autorizado.'});
    const b=bs[0];const tz=b.timezone||'UTC';new Intl.DateTimeFormat('en-US',{timeZone:tz});
    const opening=parseHours(b.opening_hours||'',date,time,duration);
    if(!opening.valid)return respond(res,200,{available:false,reason:opening.reason});
    const start=localToUTC(date,time,tz),end=new Date(start.getTime()+duration*60000);
    if(start.getTime()<Date.now())return respond(res,200,{available:false,reason:'La fecha u hora ya pasó.'});
    const path='/rest/v1/nexora_bookings?business_id=eq.'+encodeURIComponent(businessId)+'&resource=eq.'+encodeURIComponent(resource.trim())+'&start_at=lt.'+encodeURIComponent(end.toISOString())+'&select=id,start_at,duration_minutes';
    const bookings=await get(path,token);
    const occupied=bookings.some(x=>new Date(x.start_at).getTime()+x.duration_minutes*60000>start.getTime());
    return respond(res,200,{available:!occupied,reason:occupied?'Ese empleado o recurso ya tiene una cita en ese horario.':'Horario disponible para revisión y confirmación.',startAt:start.toISOString()});
  }catch(e){console.error('Availability:',e.message);return respond(res,400,{error:'No se pudo comprobar el horario. Revisa la zona horaria y los datos del negocio.'})}
};
// Funciones compartidas por el flujo de reserva automática.
module.exports.localToUTC=localToUTC;
module.exports.parseHours=parseHours;
