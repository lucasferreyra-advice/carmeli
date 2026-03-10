export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  return res.status(200).json({
    GEMINI_API_KEY:   process.env.GEMINI_API_KEY   ? '✅ existe' : '❌ no existe',
    ML_ACCESS_TOKEN:  process.env.ML_ACCESS_TOKEN  ? '✅ existe' : '❌ no existe',
    ML_CLIENT_ID:     process.env.ML_CLIENT_ID     ? '✅ existe' : '❌ no existe',
    ML_CLIENT_SECRET: process.env.ML_CLIENT_SECRET ? '✅ existe' : '❌ no existe',
    node_env: process.env.NODE_ENV,
  });
}
