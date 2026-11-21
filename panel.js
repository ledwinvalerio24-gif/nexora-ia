'use strict';
// Nexora 6.4: datos en Supabase, aislados por propietario (RLS).
// Los datos antiguos en localStorage NO se borran ni se importan automáticamente.
const $=id=>document.getElementById(id);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localDate=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
const fmt=s=>{const d=new Date(s);return isNaN(d)?s:d.toLocaleString('es',{dateStyle:'medium',timeStyle:'short'})};
let sb=null,owner=null,business=null,clients=[],bookings=[];
const status=document.createElement('p');status.setAttribute('role','status');status.className='note';
$('heading').after(status);
const setStatus=(s)=>{status.textContent=s};
function show(tab){document.querySelectorAll('.page').forEach(x=>x.classList.toggle('hidden',x.id!==tab));document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('selected',x.dataset.tab===tab));$('heading').textContent={dashboard:'Resumen',agenda:'Agenda',clientes:'Clientes',config:'Mi negocio',recepcion:'Recepcionista'}[tab];render()}
document.querySelectorAll('[data-tab]').forEach(x=>x.addEventListener('click',()=>show(x.dataset.tab)));
function bookingMarkup(b){const c=clients.find(x=>x.id===b.client_id);return `<div class="item"><div><b>${escape(b.service)}</b><small>${escape(c?.name||'Cliente eliminado')} · ${escape(fmt(b.start_at))} · ${b.duration_minutes} min · ${escape(b.resource)}</small></div><button data-delete-booking="${escape(b.id)}">Eliminar</button></div>`}
function render(){const sorted=[...bookings].sort((a,b)=>a.start_at.localeCompare(b.start_at));$('totalBookings').textContent=bookings.length;$('totalClients').textContent=clients.length;$('todayBookings').textContent=bookings.filter(b=>{const d=new Date(b.start_at);return !isNaN(d)&&`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`===localDate()}).length;const upcoming=sorted.filter(b=>new Date(b.start_at).getTime()>=Date.now());$('upcoming').innerHTML=upcoming.length?upcoming.slice(0,6).map(bookingMarkup).join(''):'<p class="muted">No hay próximas citas.</p>';$('bookingList').innerHTML=sorted.length?sorted.map(bookingMarkup).join(''):'<p class="muted">Todavía no has creado citas.</p>';$('clientList').innerHTML=clients.length?clients.map(c=>`<div class="item"><div><b>${escape(c.name)}</b><small>${escape(c.phone||'Sin teléfono')} · ${escape(c.email||'Sin correo')}</small></div><button data-delete-client="${escape(c.id)}">Eliminar</button></div>`).join(''):'<p class="muted">Todavía no hay clientes.</p>';$('bookingClient').innerHTML='<option value="">Selecciona un cliente</option>'+clients.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');$('requestClient').innerHTML='<option value="">Selecciona un cliente</option>'+clients.map(c=>`<option value="${escape(c.id)}">${escape(c.name)}</option>`).join('');if(business){$('businessName').value=business.name;$('businessType').value=business.type}}
function ensureReady(){if(!sb||!owner||!business)throw Error('Inicia sesión y espera a que se cargue el negocio.')}
async function refresh(){ensureReady();const [c,b]=await Promise.all([sb.from('nexora_clients').select('*').eq('business_id',business.id).order('created_at'),sb.from('nexora_bookings').select('*').eq('business_id',business.id).order('start_at')]);if(c.error)throw c.error;if(b.error)throw b.error;clients=c.data;bookings=b.data;render()}
function errorMessage(e){if(e.code==='23P01')return 'Ese empleado o recurso ya tiene una cita en ese horario.';if(e.code==='23503')return 'No puedes eliminar un cliente que tiene citas. Elimina primero sus citas.';return e.message||'Error inesperado'}
$('clientForm').addEventListener('submit',async e=>{e.preventDefault();const n=$('clientNotice');n.textContent='Guardando…';try{ensureReady();const {error}=await sb.from('nexora_clients').insert({business_id:business.id,name:$('clientName').value.trim(),phone:$('clientPhone').value.trim(),email:$('clientEmail').value.trim()});if(error)throw error;e.target.reset();await refresh();n.textContent='Cliente guardado en Supabase.'}catch(err){n.textContent=errorMessage(err)}});
$('bookingForm').addEventListener('submit',async e=>{e.preventDefault();const n=$('bookingNotice');n.textContent='Guardando…';try{ensureReady();const client_id=$('bookingClient').value;if(!clients.some(c=>c.id===client_id))throw Error('Selecciona un cliente registrado.');const start=`${$('bookingDate').value}T${$('bookingTime').value}`;const startDate=new Date(start);const duration_minutes=Number($('bookingDuration').value),resource=$('bookingResource').value.trim(),service=$('bookingService').value.trim();if(isNaN(startDate)||duration_minutes<15||duration_minutes>480||!resource||!service)throw Error('Revisa los datos de la cita.');const {error}=await sb.from('nexora_bookings').insert({business_id:business.id,client_id,service,start_at:startDate.toISOString(),duration_minutes,resource});if(error)throw error;e.target.reset();$('bookingDuration').value=60;$('bookingResource').value='Principal';await refresh();n.textContent='Cita guardada en Supabase.'}catch(err){n.textContent=errorMessage(err)}});
$('businessForm').addEventListener('submit',async e=>{e.preventDefault();const n=$('businessNotice');n.textContent='Guardando…';try{ensureReady();const {data,error}=await sb.from('nexora_businesses').update({name:$('businessName').value.trim(),type:$('businessType').value}).eq('id',business.id).select().single();if(error)throw error;business=data;n.textContent='Negocio actualizado en Supabase.'}catch(err){n.textContent=errorMessage(err)}});
document.addEventListener('click',async e=>{const b=e.target.closest('[data-delete-booking]'),c=e.target.closest('[data-delete-client]');if(!b&&!c)return;if(!confirm(b?'¿Eliminar esta cita?':'¿Eliminar este cliente?'))return;try{ensureReady();const table=b?'nexora_bookings':'nexora_clients';const id=b?b.dataset.deleteBooking:c.dataset.deleteClient;const {error}=await sb.from(table).delete().eq('id',id).eq('business_id',business.id);if(error)throw error;await refresh();setStatus('Registro eliminado.')}catch(err){setStatus(errorMessage(err))}});
async function start(){setStatus('Conectando a Supabase…');try{const r=await fetch('/api/public-config',{cache:'no-store'});const cfg=await r.json();if(!r.ok)throw Error(cfg.error||'Configuración no disponible');const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2');sb=createClient(cfg.url,cfg.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const {data:{user},error:authError}=await sb.auth.getUser();if(authError)throw authError;if(!user){setStatus('Inicia sesión en el chat de Nexora y vuelve a este panel.');document.querySelectorAll('form button[type="submit"]').forEach(b=>b.disabled=true);return}owner=user.id;let {data:found,error}=await sb.from('nexora_businesses').select('*').eq('owner_id',owner).maybeSingle();if(error)throw error;if(!found){const created=await sb.from('nexora_businesses').insert({owner_id:owner,name:'Mi negocio',type:'general'}).select().single();if(created.error){const retry=await sb.from('nexora_businesses').select('*').eq('owner_id',owner).single();if(retry.error)throw created.error;found=retry.data}else found=created.data}business=found;await refresh();setStatus(`Conectado · ${user.email||'Cuenta activa'} · Datos en Supabase`);sb.auth.onAuthStateChange((_event,session)=>{if(!session){owner=null;business=null;clients=[];bookings=[];render();setStatus('Sesión cerrada. Inicia sesión en el chat y recarga el panel.');document.querySelectorAll('form button[type="submit"]').forEach(b=>b.disabled=true)}})}catch(err){setStatus('No se pudo conectar: '+errorMessage(err)+' · Comprueba que ejecutaste setup-business.sql en Supabase.')}}
$('bookingDate').min=localDate();render();start();

// Recepcionista 6.4: extracción básica y confirmación humana, sin prometer IA ni integraciones activas.
const pad2=n=>String(n).padStart(2,'0');
function parseRequest(text){
 const t=text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
 const now=new Date();let day=null;
 if(/\bpasado manana\b/.test(t)){day=new Date(now.getFullYear(),now.getMonth(),now.getDate()+2)}
 else if(/\bmanana\b/.test(t)){day=new Date(now.getFullYear(),now.getMonth(),now.getDate()+1)}
 else if(/\bhoy\b/.test(t)){day=new Date(now.getFullYear(),now.getMonth(),now.getDate())}
 else {const m=t.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);if(m){day=new Date(+m[1],+m[2]-1,+m[3]);if(day.getFullYear()!==+m[1]||day.getMonth()!==+m[2]-1||day.getDate()!==+m[3])day=null}}
 const match=t.match(/\b(?:a las|a la|para las|para la)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?\s*m\.?|p\.?\s*m\.?|de la tarde|de la noche|de la manana)?/)
 ||t.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/);
 let time=null;
 if(match){let h=Number(match[1]),min=Number(match[2]||0);const mer=(match[3]||'').replace(/[^a-z]/g,'');if(h<=23&&min<=59){if(mer==='pm'||mer==='delatarde'||mer==='delanoche')h=h%12+12;else if(mer==='am'||mer==='delamanana')h=h%12;time=`${pad2(h)}:${pad2(min)}`}}
 const date=day?`${day.getFullYear()}-${pad2(day.getMonth()+1)}-${pad2(day.getDate())}`:null;
 let service='';const m=t.match(/(?:quiero|necesito|reservar|agendar|solicito|para)\s+(?:una?|el|la)?\s*(consulta|corte|reparacion|revision|limpieza|asesoria|clase|sesion|cita)(?:\s+([a-z]+))?/);if(m)service=m[1]+(m[2]&& !['hoy','manana','para','el','la','a','de'].includes(m[2])?' '+m[2]:'');
 return {date,time,service};
}
$('analyzeRequest').addEventListener('click',()=>{
 const notice=$('requestNotice');const raw=$('requestText').value.trim();$('requestProposal').hidden=true;
 if(!raw){notice.textContent='Escribe primero un mensaje de solicitud.';return}
 const result=parseRequest(raw);$('requestDate').value=result.date||'';$('requestTime').value=result.time||'';$('requestService').value=result.service||'';
 $('requestProposal').hidden=false;
 const missing=[!result.date?'fecha':null,!result.time?'hora':null,!result.service?'servicio':null].filter(Boolean);
 notice.textContent=missing.length?'Completa o corrige estos campos: '+missing.join(', ')+'.':'Solicitud interpretada. Revisa todos los datos y confirma si son correctos.';
});
$('requestForm').addEventListener('submit',async e=>{
 e.preventDefault();const n=$('requestNotice');n.textContent='Comprobando disponibilidad y guardando…';
 try{
  ensureReady();const client_id=$('requestClient').value;
  if(!clients.some(c=>c.id===client_id))throw Error('Selecciona un cliente registrado.');
  const startDate=new Date(`${$('requestDate').value}T${$('requestTime').value}`);
  const duration_minutes=Number($('requestDuration').value),resource=$('requestResource').value.trim(),service=$('requestService').value.trim();
  if(!Number.isFinite(startDate.getTime())||startDate.getTime()<Date.now()||!Number.isInteger(duration_minutes)||duration_minutes<15||duration_minutes>480||!resource||!service)throw Error('Revisa fecha futura, hora, duración, recurso y servicio.');
  const {error}=await sb.from('nexora_bookings').insert({business_id:business.id,client_id,service,start_at:startDate.toISOString(),duration_minutes,resource});
  if(error)throw error;
  await refresh();$('requestProposal').hidden=true;$('requestText').value='';n.textContent='Reserva confirmada y guardada en Supabase. Revisa la sección Agenda.';
 }catch(err){n.textContent=errorMessage(err)}
});
