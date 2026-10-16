Auth.requireLogin();
if(!hasRole('ADMIN')) window.location.href='dashboard.html';
renderShell('audit','Security Audit');
let auditPage=1, auditTotal=0;
async function loadAudit(){
  const b=document.getElementById('audit-body');
  const q=document.getElementById('audit-entity').value.trim();
  const archived=document.getElementById('audit-archived').value;
  const p=new URLSearchParams({archived,page:auditPage,limit:25}); if(q)p.set('entity_type',q);
  try{const r=await apiRequest('/audit-logs?'+p.toString());
    auditTotal=Number(r.meta?.total||r.pagination?.total||r.data.length);document.getElementById('audit-count').textContent=auditTotal.toLocaleString();document.getElementById('audit-logins').textContent=r.data.filter(x=>/LOGIN|2FA/.test(x.action)).length;document.getElementById('audit-security').textContent=r.data.filter(x=>/FAILED|PASSWORD|RESET|2FA/.test(x.action)).length;document.getElementById('audit-page-label').textContent='Page '+auditPage;document.getElementById('audit-prev').disabled=auditPage<=1;document.getElementById('audit-next').disabled=r.data.length<25;const labels={LOGIN:'Signed in',LOGIN_FAILED:'Failed sign-in','2FA_CODE_SENT':'2-step code sent','2FA_VERIFIED':'2-step verification completed',CHANGE_PASSWORD:'Changed own password',ADMIN_RESET_PASSWORD:'Administrator reset temporary password',CREATE_USER:'Created user account',UPDATE_USER:'Updated user account'}; b.innerHTML=r.data.map(x=>`<tr><td>${fmtDate(x.date_created)}</td><td>${escapeHtml(x.full_name||x.username||'System')}</td><td>${escapeHtml(labels[x.action]||x.action.replace(/_/g,' '))}</td><td>${escapeHtml(x.entity_type||'—')}</td><td>${x.entity_id||'—'}</td><td>${escapeHtml(x.ip_address||'—')}</td><td><button class="btn small outline" onclick="archiveAudit(${x.log_id},${archived==='1'?'false':'true'})">${archived==='1'?'Restore':'Archive'}</button></td></tr>`).join('')||'<tr><td colspan="7" class="empty-state">No audit entries</td></tr>'
  }catch(e){b.innerHTML=`<tr><td colspan="7" class="empty-state">${escapeHtml(e.message)}</td></tr>`}
}
async function archiveAudit(id, archived){try{await apiRequest(`/audit-logs/${id}/archive`,{method:'PATCH',body:{archived}});showToast(archived?'Audit entry archived':'Audit entry restored');loadAudit()}catch(e){showToast(e.message,true)}}
document.getElementById('audit-prev').onclick=()=>{if(auditPage>1){auditPage--;loadAudit();}};document.getElementById('audit-next').onclick=()=>{auditPage++;loadAudit();};document.getElementById('audit-search').onclick=()=>{auditPage=1;loadAudit();}; document.getElementById('audit-archived').onchange=loadAudit; loadAudit();
autoFilter(loadAudit,['audit-entity']);
