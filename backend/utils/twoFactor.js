const crypto = require('crypto');
const jwt = require('jsonwebtoken');
let nodemailer = null;
try { nodemailer = require('nodemailer'); } catch (_) {}

const challenges = new Map();
const TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_RESENDS = 3;

function maskEmail(email='') {
  const [name, domain] = String(email).split('@');
  if (!domain) return 'your registered email';
  const shown = name.length <= 2 ? name[0] || '*' : name.slice(0, 1) + '•'.repeat(Math.max(2, name.length - 2)) + name.slice(-1);
  return `${shown}@${domain}`;
}
function createChallenge(userId) {
  const id = crypto.randomBytes(24).toString('hex');
  const code = String(crypto.randomInt(100000, 1000000));
  challenges.set(id, { userId, code, expires: Date.now()+TTL_MS, attempts:0, lastSent:Date.now(), resends:0 });
  return { id, code };
}
function getResendEligibility(id) {
  const c=challenges.get(id);
  if (!c || c.expires <= Date.now()) { challenges.delete(id); return {ok:false,reason:'expired'}; }
  if (c.resends >= MAX_RESENDS) return {ok:false,reason:'limit'};
  const wait=Math.ceil((c.lastSent + RESEND_COOLDOWN_MS - Date.now())/1000);
  if (wait>0) return {ok:false,reason:'cooldown',retry_after:wait};
  return {ok:true,userId:c.userId};
}
function rotateChallenge(id, sentCode) {
  const c=challenges.get(id);
  if (!c || c.expires <= Date.now()) return null;
  const nextId=crypto.randomBytes(24).toString('hex');
  const code=String(sentCode);
  challenges.delete(id);
  challenges.set(nextId,{userId:c.userId,code,expires:Date.now()+TTL_MS,attempts:0,lastSent:Date.now(),resends:c.resends+1});
  return {id:nextId,code};
}
function verifyChallenge(id, code) {
  const c=challenges.get(id); if(!c || c.expires<Date.now()) { challenges.delete(id); return {ok:false, reason:'expired'}; }
  c.attempts++; if(c.attempts>5){challenges.delete(id);return {ok:false,reason:'attempts'};}
  if(!crypto.timingSafeEqual(Buffer.from(String(c.code)), Buffer.from(String(code||'').padStart(6,'0')))) return {ok:false,reason:'invalid'};
  challenges.delete(id); return {ok:true,userId:c.userId};
}
function makeTrustedDevice(userId){ return jwt.sign({sub:userId,purpose:'trusted_device'},process.env.JWT_SECRET,{expiresIn:'10d'}); }
function isTrustedDevice(token,userId){ try{const p=jwt.verify(token,process.env.JWT_SECRET);return p.purpose==='trusted_device' && Number(p.sub)===Number(userId);}catch(_){return false;} }
async function sendViaSmtp(email,code){
  const configured=process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.SMTP_FROM;
  if (!configured) return false;
  if (!nodemailer) throw new Error('SMTP email transport is unavailable');
  const transporter=nodemailer.createTransport({
    host:process.env.SMTP_HOST,port:Number(process.env.SMTP_PORT||587),
    secure:String(process.env.SMTP_SECURE||'false')==='true',
    auth:{user:process.env.SMTP_USER,pass:process.env.SMTP_PASS},
    connectionTimeout:10000,greetingTimeout:10000,socketTimeout:15000
  });
  await transporter.sendMail({
    from:process.env.SMTP_FROM,to:email,subject:'Your FreightSync verification code',
    text:`Your FreightSync verification code is ${code}. It expires in 10 minutes. If you did not try to sign in, contact your administrator.`
  });
  return true;
}
async function sendCode(email, code){
  const resendKey=process.env.RESEND_API_KEY;
  if(resendKey){
    const from=process.env.RESEND_FROM_EMAIL;
    if(!from) throw new Error('Resend sender address is not configured');
    const controller=new AbortController();
    const timeout=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch('https://api.resend.com/emails',{
        method:'POST',
        headers:{Authorization:`Bearer ${resendKey}`,'Content-Type':'application/json'},
        body:JSON.stringify({from,to:[email],subject:'Your FreightSync verification code',
          text:`Your FreightSync verification code is ${code}. It expires in 10 minutes. If you did not try to sign in, contact your administrator.`}),
        signal:controller.signal
      });
      if(response.ok) return {devMode:false};
      let details={};try{details=await response.json();}catch(_){}
      console.error('Resend delivery rejected:',response.status,String(details.name||details.error||'unknown'),String(details.message||'').slice(0,300));
      if(response.status===403){
        try {
          if(await sendViaSmtp(email,code)) {
            console.log('Verification email delivered using configured SMTP fallback');
            return {devMode:false};
          }
        }catch(err){console.error('SMTP fallback delivery failed:',err.code||err.message);}
        const error=new Error('Email delivery is restricted to the verified Resend testing address. Configure a verified sending domain or working SMTP provider for other users.');
        error.status=503;
        throw error;
      }
      throw new Error('Unable to send verification email. Check your email provider configuration.');
    }finally{clearTimeout(timeout);}
  }
  if(await sendViaSmtp(email,code)) return {devMode:false};
  if(process.env.NODE_ENV==='production') throw new Error('Email verification is not configured');
  console.log(`[FreightSync DEV 2FA] Verification code for ${email}: ${code}`);
  return {devMode:true};
}
module.exports={maskEmail,createChallenge,getResendEligibility,rotateChallenge,verifyChallenge,makeTrustedDevice,isTrustedDevice,sendCode};
