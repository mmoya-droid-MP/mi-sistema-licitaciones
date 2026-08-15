require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const puppeteer = require('puppeteer');
const fs = require('fs');

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generarPropuestaDisenada(codigo) {
  console.log('🎨 Generando propuesta con diseño desde AI Studio para:', codigo);
  
  try {
    const { data: op, error } = await supabase
      .from('oportunidades')
      .select('*')
      .eq('codigo_licitacion', codigo)
      .single();

    if (error || !op) return console.error('❌ Error al consultar la oportunidad:', error?.message);

    const model = genAI.getGenerativeModel({ model: 'gemini-flash-latest' });

    const prompt = `Eres el motor de diseño de GEOSOLVE (Google Cloud Partner).
Genera el código HTML completo con CSS embebido dentro de <style> para una propuesta técnica profesional lista para imprimir en A4 PDF.

DATOS:
- Licitación: ${op.codigo_licitacion} - ${op.nombre_licitacion}
- Organismo: ${op.organismo}
- Presupuesto Estimado: $${op.precio_estimado_min} - $${op.precio_estimado_max} CLP
- Estrategia / Gantt: ${op.estrategia_precio_sugerida}

REGLAS DE DISEÑO:
1. Usar paleta GEOSOLVE: Azul marino (#0f172a), Azul Cloud (#2563eb) y Fondo gris suave (#f8fafc).
2. Incluir badge distintivo: "Google Cloud Enterprise Partner".
3. Formatear la Carta Gantt en una tabla limpia con bordes redondeados.
4. Devuelve ÚNICAMENTE el código HTML directo (sin bloques markdown \`\`\`html).`;

    const result = await model.generateContent(prompt);
    let htmlContent = result.response.text().replace(/```html|```/g, '').trim();

    const htmlPath = `propuesta_${codigo}.html`;
    fs.writeFileSync(htmlPath, htmlContent);

    console.log('📄 Convirtiendo HTML a PDF con Puppeteer...');
    const browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    
    const pdfPath = `propuesta_diseñada_${codigo}.pdf`;
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
    });

    await browser.close();
    console.log(`✨ ¡PDF diseñado generado con éxito!: ${pdfPath}`);

  } catch (e) {
    console.error('❌ Error en el motor de diseño:', e.message);
  }
}

generarPropuestaDisenada('LIC-TEST-GEOSOLVE-001');
