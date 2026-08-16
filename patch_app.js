const fs = require('fs');
let app = fs.readFileSync('src/App.tsx', 'utf8');
app = app.replace(
  "        const combinedItems = [...api30Dias, ...apiOportunidades];",
  `        const combinedItems = [...api30Dias, ...apiOportunidades];\n\n        // Intentar cargar el historial de evaluaciones para enriquecer las licitaciones con el match_score\n        try {\n          const evRes = await fetch('/api/evaluaciones');\n          if (evRes.ok) {\n            const evData = await evRes.json();\n            const scoreMap = new Map();\n            evData.forEach((ev: any) => scoreMap.set(ev.codigo_proceso.toUpperCase(), ev.match_score));\n            \n            combinedItems.forEach(item => {\n              const code = item.id || item.codigo || item.CodigoExterno;\n              if (code && scoreMap.has(code.toUpperCase())) {\n                item.matchScore = scoreMap.get(code.toUpperCase());\n              }\n            });\n          }\n        } catch(e) { console.warn('Error fetching evaluations', e); }`
);
fs.writeFileSync('src/App.tsx', app);
