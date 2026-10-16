const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { ok, created, fail } = require('../utils/response');
const { logAction } = require('../utils/audit');
const { validate, EMAIL_PATTERN, USERNAME_PATTERN } = require('../utils/validate');
const { maskEmail, createChallenge, getResendEligibility, rotateChallenge, verifyChallenge, makeTrustedDevice, isTrustedDevice, sendCode } = require('../utils/twoFactor');
require('dotenv').config();
const totp=require('../utils/totp');

// Roles selectable at self-registration. ADMIN is deliberately excluded — an
// administrator account should be provisioned by an existing admin via
// POST /users, not handed out through public self-registration.
const SELF_REGISTER_ROLES = ['LOGISTICS_MANAGER', 'ROUTE_PLANNER', 'OPERATIONS_COORDINATOR'];

async function login(req, res, next) {
  try {
    const { username, password, trusted_device } = req.body;
    if (!username || !password) return fail(res, 'Username and password are required', 400);
    const [rows] = await pool.query(`SELECT u.user_id,u.username,u.email,u.password_hash,u.full_name,u.is_active,u.must_change_password,u.provider_id,u.profile_photo,r.role_name FROM users u JOIN roles r ON u.role_id=r.role_id WHERE u.username=?`,[username]);
    if (!rows.length) { await logAction({action:'LOGIN_FAILED',entityType:'USER',afterState:{username,reason:'unknown_username'},ip:req.ip}); return fail(res,'Invalid credentials',401); }
    const user=rows[0];
    if(!user.is_active) return fail(res,'This account has been deactivated',403);
    if(!(await bcrypt.compare(password,user.password_hash))){ await logAction({userId:user.user_id,action:'LOGIN_FAILED',entityType:'USER',entityId:user.user_id,afterState:{reason:'wrong_password'},ip:req.ip}); return fail(res,'Invalid credentials',401); }
    if(!process.env.JWT_SECRET || process.env.JWT_SECRET.length<32) return fail(res,'Server authentication configuration is invalid',500);
    if(trusted_device && isTrustedDevice(trusted_device,user.user_id)) return finishLogin(res,user,req);
    await totp.ensure();
    const [authenticators]=await pool.query('SELECT secret_encrypted,confirmed FROM user_totp WHERE user_id=?',[user.user_id]);
    if(authenticators.length && authenticators[0].confirmed){
      const challenge_id=jwt.sign({sub:user.user_id,purpose:'totp_login'},process.env.JWT_SECRET,{expiresIn:'5m'});
      return ok(res,{requires_2fa:true,method:'authenticator',challenge_id});
    }
    const challenge=createChallenge(user.user_id);
    try{
      const delivery=await sendCode(user.email,challenge.code);
      await logAction({userId:user.user_id,action:'2FA_CODE_SENT',entityType:'USER',entityId:user.user_id,ip:req.ip});
      return ok(res,{requires_2fa:true,method:'email',challenge_id:challenge.id,masked_email:maskEmail(user.email),dev_mode:delivery.devMode});
    }catch(deliveryError){
      if(!/restricted to the verified Resend testing address/.test(String(deliveryError.message)))throw deliveryError;
      const secret=authenticators.length?totp.decrypt(authenticators[0].secret_encrypted):totp.base32(require('crypto').randomBytes(20));
      if(!authenticators.length)await pool.query('INSERT INTO user_totp(user_id,secret_encrypted,confirmed) VALUES(?,?,0)',[user.user_id,totp.encrypt(secret)]);
      const setup_token=jwt.sign({sub:user.user_id,purpose:'totp_setup'},process.env.JWT_SECRET,{expiresIn:'10m'});
      const uri='otpauth://totp/'+encodeURIComponent('FreightSync:'+user.username)+'?secret='+secret+'&issuer=FreightSync&algorithm=SHA1&digits=6&period=30';
      return ok(res,{requires_2fa:true,method:'authenticator_setup',setup_token,secret,otpauth_uri:uri});
    }
  } catch(err){ next(err); }
}

async function finishLogin(res,user,req,trustDevice=false){
  const payload={user_id:user.user_id,username:user.username,role:user.role_name,provider_id:user.provider_id};
  const token=jwt.sign(payload,process.env.JWT_SECRET,{expiresIn:process.env.JWT_EXPIRES_IN||'8h',algorithm:'HS256'});
  await logAction({userId:user.user_id,action:'LOGIN',entityType:'USER',entityId:user.user_id,ip:req.ip});
  return ok(res,{token,user:{user_id:user.user_id,username:user.username,email:user.email,full_name:user.full_name,role:user.role_name,provider_id:user.provider_id,profile_photo:user.profile_photo||null,must_change_password:Boolean(user.must_change_password)},trusted_device:trustDevice?makeTrustedDevice(user.user_id):null});
}

async function verifyAuthenticator(req,res,next){
  try{
    const {setup_token,challenge_id,code,trust_device}=req.body||{};
    const setup=Boolean(setup_token);
    const payload=jwt.verify(setup?setup_token:challenge_id,process.env.JWT_SECRET,{algorithms:['HS256']});
    if(payload.purpose!==(setup?'totp_setup':'totp_login'))return fail(res,'Invalid verification session',401);
    if(!/^\\d{6}$/.test(String(code||'')))return fail(res,'Enter a six-digit authenticator code',400);
    await totp.ensure();
    const [records]=await pool.query('SELECT secret_encrypted,confirmed,last_step FROM user_totp WHERE user_id=?',[payload.sub]);
    if(!records.length || (setup && records[0].confirmed) || (!setup && !records[0].confirmed))return fail(res,'Authenticator setup is unavailable',403);
    const secret=totp.decrypt(records[0].secret_encrypted);
    if(!totp.check(secret,String(code)))return fail(res,'Invalid authenticator code',401);
    const step=Math.floor(Date.now()/30000);
    if(!setup && Number(records[0].last_step)>=step-1)return fail(res,'Code already used. Wait for the next code.',401);
    await pool.query('UPDATE user_totp SET confirmed=1,last_step=? WHERE user_id=?',[step,payload.sub]);
    const [users]=await pool.query('SELECT u.user_id,u.username,u.email,u.full_name,u.is_active,u.must_change_password,u.provider_id,u.profile_photo,r.role_name FROM users u JOIN roles r ON u.role_id=r.role_id WHERE u.user_id=?',[payload.sub]);
    if(!users.length||!users[0].is_active)return fail(res,'Account unavailable',403);
    await logAction({userId:users[0].user_id,action:setup?'2FA_AUTHENTICATOR_ENROLLED':'2FA_AUTHENTICATOR_VERIFIED',entityType:'USER',entityId:users[0].user_id,ip:req.ip});
    return finishLogin(res,users[0],req,Boolean(trust_device));
  }catch(e){if(e.name==='JsonWebTokenError'||e.name==='TokenExpiredError')return fail(res,'Verification session expired. Sign in again.',401);next(e);}
}

async function resendTwoFactor(req,res,next) {
  try {
    const {challenge_id}=req.body || {};
    if (typeof challenge_id !== 'string' || !/^[a-f0-9]{48}$/.test(challenge_id)) return fail(res,'Verification session expired. Please sign in again.',400);
    const eligibility=getResendEligibility(challenge_id);
    if (!eligibility.ok) {
      if (eligibility.reason==='cooldown') return res.status(429).json({success:false,message:`Please wait ${eligibility.retry_after} seconds before requesting another code.`,retry_after:eligibility.retry_after});
      return fail(res,eligibility.reason==='limit'?'Resend limit reached. Please sign in again.':'Verification session expired. Please sign in again.',429);
    }
    const [rows]=await pool.query('SELECT user_id,email,is_active FROM users WHERE user_id=?',[eligibility.userId]);
    if (!rows.length || !rows[0].is_active) return fail(res,'Account unavailable',403);
    // Send first; preserve the previous valid challenge if delivery fails.
    // The old code is invalidated only after successful delivery.
    const nextCode=String(require('crypto').randomInt(100000,1000000));
    const delivery=await sendCode(rows[0].email,nextCode);
    const replacement=rotateChallenge(challenge_id,nextCode);
    if (!replacement) return fail(res,'Verification session expired. Please sign in again.',400);
    await logAction({userId:rows[0].user_id,action:'2FA_CODE_RESENT',entityType:'USER',entityId:rows[0].user_id,ip:req.ip});
    return ok(res,{challenge_id:replacement.id,masked_email:maskEmail(rows[0].email),dev_mode:delivery.devMode,cooldown_seconds:60});
  } catch(err) {next(err);}
}

async function verifyTwoFactor(req,res,next){
  try{
    const {challenge_id,code,trust_device}=req.body;
    if(!challenge_id || !/^\d{6}$/.test(String(code||''))) return fail(res,'Enter the 6-digit verification code',400);
    const check=verifyChallenge(challenge_id,String(code));
    if(!check.ok) return fail(res,check.reason==='expired'?'Verification code expired. Please sign in again.':check.reason==='attempts'?'Too many incorrect codes. Please sign in again.':'Invalid verification code',401);
    const [rows]=await pool.query(`SELECT u.user_id,u.username,u.email,u.full_name,u.is_active,u.must_change_password,u.provider_id,u.profile_photo,r.role_name FROM users u JOIN roles r ON u.role_id=r.role_id WHERE u.user_id=?`,[check.userId]);
    if(!rows.length || !rows[0].is_active) return fail(res,'Account unavailable',403);
    await logAction({userId:rows[0].user_id,action:'2FA_VERIFIED',entityType:'USER',entityId:rows[0].user_id,ip:req.ip});
    return finishLogin(res,rows[0],req,Boolean(trust_device));
  }catch(err){next(err);}
}

async function register(req, res, next) {
  try {
    const { username, email, password, full_name, role } = req.body;

    // SECURITY CONTROL: Input Validation
    const errors = validate(req.body, {
      full_name: { required: true, type: 'string', min: 2, max: 100, label: 'Full name' },
      username: { required: true, type: 'string', pattern: USERNAME_PATTERN, label: 'Username (3-30 letters/numbers/._-)' },
      email: { required: true, type: 'string', pattern: EMAIL_PATTERN, label: 'Email' },
      password: { required: true, type: 'string', min: 8, max: 72, label: 'Password (min 8 characters)' },
      role: { required: true, enum: SELF_REGISTER_ROLES, label: 'Role' }
    });
    if (errors.length) return fail(res, errors[0], 400, errors);

    const [existing] = await pool.query('SELECT user_id FROM users WHERE username = ? OR email = ?', [username, email]);
    if (existing.length) return fail(res, 'That username or email is already registered', 409);

    const [roleRows] = await pool.query('SELECT role_id FROM roles WHERE role_name = ?', [role]);
    if (roleRows.length === 0) return fail(res, 'Invalid role', 400);

    // SECURITY CONTROL: Password Security — bcrypt hash, never stored/logged in plaintext.
    const password_hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users (username, email, password_hash, full_name, role_id) VALUES (?, ?, ?, ?, ?)`,
      [username, email, password_hash, full_name, roleRows[0].role_id]
    );

    await logAction({ userId: result.insertId, action: 'REGISTER', entityType: 'USER', entityId: result.insertId, afterState: { username, email, role }, ip: req.ip });

    // Log the new user straight in, same as a successful login, so registration flows straight into the app.
    const payload = { user_id: result.insertId, username, role, provider_id: null };
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return fail(res, 'Server authentication configuration is invalid', 500);
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });

    return created(res, {
      token,
      user: { user_id: result.insertId, username, full_name, role, provider_id: null }
    });
  } catch (err) {
    next(err);
  }
}

async function me(req, res, next) {
  try {
    const [rows] = await pool.query(
      `SELECT u.user_id, u.username, u.email, u.full_name, u.provider_id, u.is_active, u.must_change_password, u.date_created, u.profile_photo, u.phone, r.role_name
       FROM users u JOIN roles r ON u.role_id = r.role_id
       WHERE u.user_id = ?`,
      [req.user.user_id]
    );
    if (rows.length === 0) return fail(res, 'User not found', 404);
    return ok(res, rows[0]);
  } catch (err) {
    next(err);
  }
}

/** Self-service: a logged-in user may update their own display name only
 *  (role/email/username changes still require an Administrator via /users). */
async function updateMe(req, res, next) {
  try {
    const { full_name, phone = null, profile_photo = null } = req.body;
    const errors = validate({full_name}, { full_name: { required: true, type: 'string', min: 2, max: 100, label: 'Full name' } });
    if (errors.length) return fail(res, errors[0], 400, errors);
    if (phone && String(phone).length > 30) return fail(res, 'Phone number is too long', 400);
    if (profile_photo) {
      if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(profile_photo)) return fail(res, 'Profile photo must be PNG, JPEG, or WebP', 400);
      if (profile_photo.length > 1400000) return fail(res, 'Profile photo must be 1 MB or smaller', 400);
    }
    await pool.query('UPDATE users SET full_name = ?, phone = ?, profile_photo = COALESCE(?, profile_photo) WHERE user_id = ?', [full_name, phone || null, profile_photo || null, req.user.user_id]);
    await logAction({ userId: req.user.user_id, action: 'UPDATE_OWN_PROFILE', entityType: 'USER', entityId: req.user.user_id, afterState: { full_name, phone, profile_photo_changed: Boolean(profile_photo) } });
    return ok(res, { user_id: req.user.user_id, full_name, phone });
  } catch (err) {
    next(err);
  }
}


async function changePassword(req, res, next) {
  try {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) return fail(res, 'Current password and new password are required', 400);
    if (new_password.length < 8 || new_password.length > 72 || !/[A-Z]/.test(new_password) || !/[a-z]/.test(new_password) || !/\d/.test(new_password) || !/[^A-Za-z0-9]/.test(new_password)) return fail(res, 'New password must be 8-72 characters and include uppercase, lowercase, number, and symbol', 400);
    const [rows] = await pool.query('SELECT password_hash FROM users WHERE user_id = ?', [req.user.user_id]);
    if (!rows.length) return fail(res, 'User not found', 404);
    if (!(await bcrypt.compare(current_password, rows[0].password_hash))) return fail(res, 'Current password is incorrect', 400);
    const password_hash = await bcrypt.hash(new_password, 10);
    await pool.query('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE user_id = ?', [password_hash, req.user.user_id]);
    await logAction({ userId: req.user.user_id, action: 'CHANGE_PASSWORD', entityType: 'USER', entityId: req.user.user_id, ip: req.ip });
    return ok(res, { changed: true });
  } catch (err) { next(err); }
}

module.exports = { login, verifyAuthenticator, verifyTwoFactor, resendTwoFactor, register, me, updateMe, changePassword, SELF_REGISTER_ROLES };
