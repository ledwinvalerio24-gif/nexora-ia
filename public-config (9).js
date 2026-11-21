module.exports = (req, res) => {
  res.setHeader('Cache-Control','no-store');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key || !/^https:\/\//.test(url) || !key.startsWith('sb_publishable_') && !key.startsWith('eyJ')) {
    return res.status(503).json({error:'Faltan SUPABASE_URL y/o SUPABASE_ANON_KEY válidas en Vercel.'});
  }
  return res.status(200).json({url,key}); // SOLO clave pública, nunca sb_secret_
};
