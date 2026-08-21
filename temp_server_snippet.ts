function createDynamicFallback(licitacion: any) {
  const dynamicScore = computeDynamicMatchScore(licitacion);
  const cod = licitacion?.codigo || 'S/I';
  const cliente = licitacion?.cliente || 'Organismo Comprador';
  const rawNombre = licitacion?.nombre || 'Requerimiento de Adquisición';
  const cleanNombre = rawNombre.replace(/^(SOLICITA|ADQUISICIÓN DE|CONTRATACIÓN DE|SERVICIO DE|LICITACIÓN PÚBLICA PARA)\s+/i, '');
  const dias = typeof licitacion?.diasRestantes === 'number' ? licitacion.diasRestantes : 5;
  const monto = licitacion?.montoEstimadoClp ? `$${licitacion.montoEstimadoClp.toLocaleString('es-CL')} CLP` : 'No informado';
  const tipo = licitacion?.tipo === 'Compra Agil' ? 'Compra Ágil' : licitacion?.tipo === 'Convenio Marco' ? 'Convenio Marco' : 'Licitación Pública';

  const reqList = [
    `Verificar TDR específicos para "${cleanNombre.substring(0, 60)}" (ID: ${cod})`,
    `Acreditar experiencia institucional previa en proyectos de ${tipo} para ${cliente}`,
    `Garantizar la disponibilidad del equipo profesional con certificaciones vigentes`
  ];

  const riskList = [
    dias <= 3
      ? `Cierre acotado: restan solo ${dias} día(s) para la carga formal en el portal Mercado Público`
      : `Revisar aclaraciones en el foro de preguntas y respuestas para el proceso ${cod}`,
    `Verificar presupuesto estimado (${monto}) y constitución de boletas de seriedad de oferta`
  ];

  const recList = [
    `Destacar casos de éxito con servicios tecnológicos ante ${cliente} u organismos análogos`,
    `Ingresar la oferta en el portal Mercado Público con al menos 12 horas de anticipación a la fecha de cierre`
  ];

  const perfilesList = [
    "Jefe de Proyecto TI / Consultor Especialista",
    "Arquitecto de Soluciones / Desarrollador Senior"
  ];

  return {
    matchScore: dynamicScore,
    resumenEjecutivo: `Análisis de compatibilidad para el proceso ID ${cod} ("${cleanNombre}") de ${cliente}: Presenta una afinidad estimada del ${dynamicScore}%. El requerimiento encaja con los servicios tecnológicos de la empresa para la modalidad ${tipo}.`,
    requisitos: reqList,
    requisitosClave: reqList,
    riesgos: riskList,
    riesgosDetectados: riskList,
    recomendaciones: recList,
    recomendacionesEstrategicas: recList,
    perfilesRequeridos: perfilesList
  };
}

// Server-side AI analysis using Gemini @google/genai
app.post("/api/ai/analyze", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    const { licitacion, perfilEmpresa } = req.body;

    if (!licitacion) {
      return res.status(400).json({ error: "Faltan datos de la licitación." });
    }

    if (!apiKey) {
      return res.json(createDynamicFallback(licitacion));
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `
Analiza minuciosamente la siguiente oportunidad e indica la viabilidad y recomendación estratégica para postular:

DATOS DE LA LICITACIÓN/COTIZACIÓN:
- Código ID: ${licitacion.codigo}
- Título/Requerimiento: ${licitacion.nombre}
- Organismo Comprador: ${licitacion.cliente}
- Descripción: ${licitacion.descripcion || "No especificada"}
- Tipo de Proceso: ${licitacion.tipo}
- Monto Estimado: ${licitacion.montoEstimadoClp ? `$${licitacion.montoEstimadoClp.toLocaleString('es-CL')} CLP` : "No informado"}
- Plazo de Cierre: ${licitacion.diasRestantes} días restantes
- Etiquetas/Tecnologías: ${licitacion.tags ? licitacion.tags.join(', ') : 'S/I'}

PERFIL DE LA EMPRESA CONSULTORA:
${perfilEmpresa || "Empresa de Tecnología, Consultoría TI, Desarrollo de Software, Integración Cloud (GCP/AWS/Azure), Google Maps/GIS, Ciberseguridad y Analítica de Datos."}

INSTRUCCIONES CRÍTICAS:
1. DIVERSIFICACIÓN DEL MATCH SCORE: Evalúa la afinidad tecnológica real entre el requerimiento y la empresa. Calcula un "matchScore" numérico entero verdaderamente variable entre 45 y 98 (porcentaje). NUNCA uses un número estático ni valores por defecto repetidos.
2. CONTENIDO DINÁMICO ESPECÍFICO POR LICITACIÓN: En los puntos de "requisitos", "riesgos" y "recomendaciones", CITA elementos específicos del título ("${licitacion.nombre}"), la descripción o el organismo comprador ("${licitacion.cliente}") de la ficha activa, evitando respuestas genéricas repetidas.
3. ESTRUCTURA OBLIGATORIA DE LA CARTA GANTT EN MARKDOWN: Basado en el plazo total exigido en la licitación, genera una tabla en Markdown con la siguiente estructura de fases y hitos para GEOSOLVE:
| Fase / Hito del Proyecto | Entregables Claves | Período 1 | Período 2 | Período 3 | Período 4 |
| :--- | :--- | :---: | :---: | :---: | :---: |
| 1. Levantamiento y Arquitectura | Informe de Diagnóstico y Plan de Trabajo | ████ | | | |
| 2. Configuración e Integración | Entorno GCP, APIs o Desarrollo Web listo | | ████ | | |
| 3. Migración de Datos y Pruebas | Base de datos migrada y QA aprobado | | | ████ | |
| 4. Capacitación y Soporte SLA | Manuales, Transferencia y Soporte activo | | | | ████ |
Nota: Adapta los períodos (Semanas o Meses) según la duración total solicitada por el comprador.
4. ESTRUCTURA DE SALIDA JSON ESTRICTO: Genera la salida según el esquema solicitado.
`;

    const response = await withAIRetry(() => ai.models.generateContent({
      model: "gemini-3.7-flash",
      contents: prompt,
      config: {
        systemInstruction: perfilEmpresaTexto,
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            matchScore: {
              type: "NUMBER",
              description: "Valor numérico entero variable entre 45 y 98 según el nivel de coincidencia real de palabras clave y tecnologías exigidas"
            },
            resumenEjecutivo: {
              type: "STRING",
              description: "Resumen estratégico corto de 2 a 3 frases citando explícitamente a " + licitacion.cliente + " y el requerimiento"
            },
            requisitos: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Puntos de Requisitos Clave TDR citando detalles específicos de " + licitacion.nombre
            },
            requisitosClave: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            riesgos: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Puntos de Riesgos y Barreras Detectadas específicos para el proceso " + licitacion.codigo
            },
            riesgosDetectados: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            recomendaciones: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Recomendaciones ganadoras específicas para la propuesta"
            },
            recomendacionesEstrategicas: {
              type: "ARRAY",
              items: { type: "STRING" }
            },
            perfilesRequeridos: {
              type: "ARRAY",
              items: { type: "STRING" },
              description: "Perfiles profesionales solicitados"
            },
            cartaGantt: {
              type: "STRING",
              description: "Tabla Markdown de la Carta Gantt siguiendo estrictamente la estructura solicitada"
            }
          },
          required: ["matchScore", "resumenEjecutivo", "requisitos", "riesgos", "recomendaciones", "cartaGantt"]
        }
      },
    }));

    let text =
      response?.text ||
      (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "{}";

    // Limpieza estricta de markdown antes del JSON.parse
    text = text.replace(/```json/i, '').replace(/```/g, '').trim();

    let rawResult: any = {};
    try {
      rawResult = JSON.parse(text);
    } catch {
      rawResult = {};
    }

    const fallback = createDynamicFallback(licitacion);

    const matchScore = typeof rawResult.matchScore === 'number' && !isNaN(rawResult.matchScore)
      ? Math.min(98, Math.max(45, Math.round(rawResult.matchScore)))
      : fallback.matchScore;

    const reqList = (Array.isArray(rawResult.requisitos) && rawResult.requisitos.length > 0)
      ? rawResult.requisitos
      : (Array.isArray(rawResult.requisitosClave) && rawResult.requisitosClave.length > 0)
      ? rawResult.requisitosClave
      : fallback.requisitos;

    const riskList = (Array.isArray(rawResult.riesgos) && rawResult.riesgos.length > 0)
      ? rawResult.riesgos
      : (Array.isArray(rawResult.riesgosDetectados) && rawResult.riesgosDetectados.length > 0)
      ? rawResult.riesgosDetectados
      : fallback.riesgos;

    const recList = (Array.isArray(rawResult.recomendaciones) && rawResult.recomendaciones.length > 0)
      ? rawResult.recomendaciones
      : (Array.isArray(rawResult.recomendacionesEstrategicas) && rawResult.recomendacionesEstrategicas.length > 0)
      ? rawResult.recomendacionesEstrategicas
      : fallback.recomendaciones;

    const perfilesList = Array.isArray(rawResult.perfilesRequeridos) && rawResult.perfilesRequeridos.length > 0
      ? rawResult.perfilesRequeridos
      : fallback.perfilesRequeridos;

    const finalResult = {
      matchScore,
      resumenEjecutivo: rawResult.resumenEjecutivo || fallback.resumenEjecutivo,
      requisitos: reqList,
      requisitosClave: reqList,
      riesgos: riskList,
      riesgosDetectados: riskList,
      recomendaciones: recList,
      recomendacionesEstrategicas: recList,
      perfilesRequeridos: perfilesList,
      cartaGantt: rawResult.cartaGantt || ""
    };

    return res.json(finalResult);
