let challenge=sessionStorage.getItem('fms_2fa_challenge');if(!challenge)location.replace('index.html');document.getElementById('masked-email').textContent=sessionStorage.getItem('fms_2fa_email')||'your registered email';if(sessionStorage.getItem('fms_2fa_dev')==='1')document.getElementById('dev-hint').textContent='Local development: the verification code is printed in the backend terminal until SMTP email is configured.';
const resendBtn=document.getElementById('resend-code');
const resendStatus=document.getElementById('resend-status');
let remaining=60;
function updateResend(){resendBtn.disabled=remaining>0;resendBtn.textContent=remaining>0?`Resend code in ${remaining}s`:'Resend verification code';}
updateResend();
setInterval(()=>{if(remaining>0){remaining--;updateResend();}},1000);
resendBtn.onclick=async()=>{
  if(remaining>0)return;
  resendBtn.disabled=true;resendBtn.textContent='Sending…';resendStatus.textContent='';
  try{
    const r=await apiRequest('/auth/resend-2fa',{method:'POST',body:{challenge_id:challenge}});
    challenge=r.data.challenge_id;sessionStorage.setItem('fms_2fa_challenge',challenge);
    document.getElementById('masked-email').textContent=r.data.masked_email;
    document.getElementById('code').value='';remaining=60;updateResend();
    resendStatus.textContent='New code sent. Your previous code is no longer valid.';
  }catch(e){
    if(e.retry_after)remaining=e.retry_after;
    resendStatus.textContent=e.message||'Unable to resend code. Please try again.';
    updateResend();
  }
};
document.getElementById('cancel-login').onclick=()=>{sessionStorage.removeItem('fms_2fa_challenge');sessionStorage.removeItem('fms_pending_password');sessionStorage.removeItem('fms_pending_username');location.href='index.html';};document.getElementById('verify-form').onsubmit=async e=>{e.preventDefault();const box=document.getElementById('verify-error');box.style.display='none';try{const r=await apiRequest('/auth/verify-2fa',{method:'POST',body:{challenge_id:challenge,code:document.getElementById('code').value.trim(),trust_device:document.getElementById('trust-device').checked}});Auth.setSession(r.data.token,r.data.user);if(r.data.trusted_device){const u=sessionStorage.getItem('fms_pending_username')||r.data.user.username;localStorage.setItem('fms_trusted_device:'+u,r.data.trusted_device);}sessionStorage.removeItem('fms_2fa_challenge');location.href='dashboard.html';}catch(x){const msg=String(x.message||'Verification failed');box.textContent=msg==='Invalid verification code'?'Incorrect code. Check the six digits and try again.':msg;box.style.display='block';document.getElementById('code').focus();}};
