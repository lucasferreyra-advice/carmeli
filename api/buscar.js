// api/buscar.js - MODO DE DIAGNÓSTICO

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const accessToken = process.env.ML_ACCESS_TOKEN;

  // Si no encuentra la variable, nos lo dirá.
  if (!accessToken) {
    return res.status(404).json({
      problema: "Variable de entorno no encontrada",
      detalle: "process.env.ML_ACCESS_TOKEN está vacío o no existe."
    });
  }

  // Si encuentra la variable, nos mostrará qué contiene.
  // Esto nos permite comparar el token que USA la función
  // con el token que CREES que debería estar usando.
  return res.status(200).json({
    diagnostico: "Este es el token que la función está intentando usar.",
    token_recibido: accessToken
  });
}
