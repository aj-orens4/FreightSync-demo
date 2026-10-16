const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const router = express.Router();
router.post('/initialize', async (req,res) => {
  try {
    const { setup_token, password } = req.body || {};
    const expected = process.env.ADMIN_SETUP_TOKEN || '';
    if (!expected || !setup_token || !crypto.timingSafeEqual(Buffer.from(crypto.createHash('sha256').update(String(setup_token)).digest()), Buffer.from(crypto.createHash('sha256').update(expected).digest()))) return res.status(403).json({success:false,message:'Invalid setup code'});
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) return res.status(503).json({success:false,message:'Authentication is not configured'});
    if (typeof password !== 'string' || password.length < 12 || password.length > 128 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) return res.status(400).json({success:false,message:'Password must be 12+ characters with uppercase, lowercase, number, and symbol'});
    const email=process.env.ADMIN_SETUP_EMAIL;
    if (!email) return res.status(503).json({success:false,message:'Setup email is missing'});
    const [admins]=await pool.query("SELECT u.user_id FROM users u JOIN roles r ON u.role_id=r.role_id WHERE r.role_name='ADMIN' LIMIT 1");
    if(admins.length) return res.status(409).json({success:false,message:'Administrator already exists; setup is closed'});
    const hash=await bcrypt.hash(password,12);
    const [result]=await pool.query("INSERT INTO users (username,email,password_hash,full_name,role_id,is_active,must_change_password) SELECT 'admin',?,?, 'FreightSync Administrator',role_id,1,0 FROM roles WHERE role_name='ADMIN'",[email,hash]);
    if (!result.insertId) return res.status(500).json({success:false,message:'Admin role unavailable'});
    const user={user_id:result.insertId,username:'admin',email,full_name:'FreightSync Administrator',role:'ADMIN',provider_id:null,must_change_password:false};
    const token=jwt.sign({user_id:user.user_id,username:'admin',role:'ADMIN',provider_id:null},process.env.JWT_SECRET,{expiresIn:'8h',algorithm:'HS256'});
    res.json({success:true,data:{token,user}});
  } catch(e){ console.error('Administrator setup failed:',e.code || e.message);res.status(500).json({success:false,message:'Setup failed. Check server logs.'});}
});
module.exports=router;
