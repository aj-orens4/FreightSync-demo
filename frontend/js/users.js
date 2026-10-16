let providerOptions=[];
async function loadProviderOptions(){
  try{const r=await apiRequest('/users/providers');providerOptions=r.data||[];['u-provider','e-provider'].forEach(id=>{const el=document.getElementById(id);if(!el)return;const keep=el.value;el.innerHTML='<option value="">Not assigned</option>'+providerOptions.map(p=>`<option value="${p.provider_id}">${escapeHtml(p.provider_code||String(p.provider_id))} — ${escapeHtml(p.provider_name)}</option>`).join('');el.value=keep;});}catch(e){showToast('Could not load service providers',true)}
}
Auth.requireLogin();
if (!hasRole('ADMIN')) window.location.href='dashboard.html';
renderShell('users','User Management');

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/;
function passwordMessage(value){
  if(value.length < 8) return 'Use at least 8 characters.';
  if(!/[A-Z]/.test(value)) return 'Add at least one uppercase letter.';
  if(!/[a-z]/.test(value)) return 'Add at least one lowercase letter.';
  if(!/\d/.test(value)) return 'Add at least one number.';
  if(!/[^A-Za-z0-9]/.test(value)) return 'Add at least one special character.';
  return '';
}
function generateTemporaryPassword(){
  const upper='ABCDEFGHJKLMNPQRSTUVWXYZ', lower='abcdefghijkmnopqrstuvwxyz', digits='23456789', symbols='!@#$%&*?';
  const all=upper+lower+digits+symbols, bytes=new Uint32Array(10); crypto.getRandomValues(bytes);
  const pick=(chars,n)=>chars[bytes[n]%chars.length];
  let chars=[pick(upper,0),pick(lower,1),pick(digits,2),pick(symbols,3)];
  for(let i=4;i<10;i++) chars.push(pick(all,i));
  for(let i=chars.length-1;i>0;i--){const j=bytes[i]%(i+1);[chars[i],chars[j]]=[chars[j],chars[i]];}
  return chars.join('');
}
function fillTemporaryPassword(){document.getElementById('u-password').value=generateTemporaryPassword();}

async function loadUsers(){
  const b=document.getElementById('users-body');
  try{
    const r=await apiRequest('/users');
    b.innerHTML=r.data.map(u=>`<tr><td>${escapeHtml(u.full_name)}</td><td>${escapeHtml(u.username)}</td><td>${escapeHtml(u.email)}</td><td>${escapeHtml(u.role_name)}</td><td>${u.provider_id||'—'}</td><td><span class="badge ${u.is_active?'Active':'Inactive'}">${u.is_active?'Active':'Inactive'}</span></td><td>${u.must_change_password?'<span class="badge Draft">Password change required</span>':'Complete'}</td><td><div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn small outline" onclick="openEditUser(${u.user_id},'${escapeHtml(u.full_name)}','${escapeHtml(u.email)}','${escapeHtml(u.role_name)}',${u.provider_id||'null'})">Edit Account</button><button class="btn small outline" onclick="toggleUser(${u.user_id},${u.is_active?0:1})">${u.is_active?'Deactivate':'Activate'}</button><button class="btn small outline" onclick="openPasswordReset(${u.user_id},'${escapeHtml(u.username)}')">Set / Reset Password</button></div></td></tr>`).join('')||'<tr><td colspan="8" class="empty-state">No users</td></tr>';
  }catch(e){b.innerHTML=`<tr><td colspan="8" class="empty-state">${escapeHtml(e.message)}</td></tr>`}
}
async function toggleUser(id,is_active){try{await apiRequest('/users/'+id,{method:'PUT',body:{is_active}});showToast(is_active?'User activated':'User deactivated');loadUsers()}catch(e){showToast(e.message,true)}}

const resetModal=document.getElementById('password-reset-modal');
let resetUserId=null;
function openPasswordReset(id,username){
  resetUserId=id; document.getElementById('reset-user-label').textContent=username;
  document.getElementById('reset-password').value=generateTemporaryPassword();
  document.getElementById('reset-password-feedback').textContent='Strong temporary password ready. You may replace it with your own strong password.';
  resetModal.classList.add('open');
}
document.getElementById('btn-reset-eye').onclick=()=>{const p=document.getElementById('reset-password');p.type=p.type==='password'?'text':'password';};
document.getElementById('btn-reset-generate').onclick=()=>{document.getElementById('reset-password').value=generateTemporaryPassword();document.getElementById('reset-password-feedback').textContent='Strong temporary password ready.';};
document.getElementById('btn-cancel-reset').onclick=()=>resetModal.classList.remove('open');
document.getElementById('reset-password').addEventListener('input',e=>{const msg=passwordMessage(e.target.value);document.getElementById('reset-password-feedback').textContent=msg||'Strong password.';document.getElementById('reset-password-feedback').className='password-feedback '+(msg?'weak':'strong');});
document.getElementById('reset-password-form').onsubmit=async e=>{
  e.preventDefault(); const temporary_password=document.getElementById('reset-password').value; const msg=passwordMessage(temporary_password);
  if(msg){showToast(msg,true);return;}
  try{await apiRequest(`/users/${resetUserId}/reset-password`,{method:'POST',body:{temporary_password}}); resetModal.classList.remove('open'); alert(`Temporary password set successfully:\n\n${temporary_password}\n\nCopy it now and give it securely to the user. They must change it at next login.`); loadUsers();}catch(err){showToast(err.message,true)}
};
window.toggleUser=toggleUser; window.openPasswordReset=openPasswordReset; window.openEditUser=openEditUser;

const editModal=document.getElementById('edit-user-modal');
let editUserId=null;
function openEditUser(id,name,email,role,providerId){
  editUserId=id;
  document.getElementById('e-name').value=name||'';
  document.getElementById('e-email').value=email||'';
  document.getElementById('e-role').value=role||'OPERATIONS_COORDINATOR';
  document.getElementById('e-provider').value=providerId||'';
  editModal.classList.add('open');
}
document.getElementById('btn-cancel-edit').onclick=()=>editModal.classList.remove('open');
document.getElementById('edit-user-form').onsubmit=async e=>{
  e.preventDefault();
  const email=document.getElementById('e-email').value.trim();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){showToast('Enter a real, deliverable email address for 2-step verification.',true);return;}
  const pv=document.getElementById('e-provider').value;
  try{
    await apiRequest('/users/'+editUserId,{method:'PUT',body:{full_name:document.getElementById('e-name').value.trim(),email,role:document.getElementById('e-role').value,provider_id:pv?Number(pv):null}});
    editModal.classList.remove('open'); showToast('Account updated. Future 2-step codes will go to '+email); loadUsers();
  }catch(err){showToast(err.message,true)}
};


const m=document.getElementById('user-modal');
document.getElementById('btn-new-user').onclick=()=>{document.getElementById('provision-result').classList.remove('open');fillTemporaryPassword();m.classList.add('open')};
document.getElementById('btn-cancel-user').onclick=()=>m.classList.remove('open');
document.getElementById('btn-generate-password').onclick=fillTemporaryPassword;
document.getElementById('user-form').onsubmit=async e=>{
  e.preventDefault(); const pv=document.getElementById('u-provider').value; const password=document.getElementById('u-password').value;
  const username=document.getElementById('u-username').value; const msg=passwordMessage(password); if(msg){showToast(msg,true);return;}
  try{
    await apiRequest('/users',{method:'POST',body:{full_name:document.getElementById('u-name').value,username,email:document.getElementById('u-email').value,password,role:document.getElementById('u-role').value,provider_id:pv?Number(pv):null}});
    document.getElementById('provision-result').innerHTML=`<strong>Account provisioned.</strong><br>Username: <span class="credential-value">${escapeHtml(username)}</span><br>Temporary password: <span class="credential-value" id="created-temp-password">${escapeHtml(password)}</span> <button type="button" class="btn small outline" onclick="navigator.clipboard.writeText(document.getElementById('created-temp-password').textContent);showToast('Temporary password copied')">Copy</button><br><small>Give these credentials to the user securely. FreightSync will require a new strong password at first login.</small>`;
    document.getElementById('provision-result').classList.add('open'); showToast('User account provisioned'); loadUsers();
  }catch(err){showToast(err.message,true)}
};
loadProviderOptions();
loadUsers();
