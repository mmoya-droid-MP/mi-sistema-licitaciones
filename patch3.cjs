const fs = require('fs');
let code = fs.readFileSync('src/components/LicitacionesRadarView.tsx', 'utf8');
const lines = code.split('\n');

const components = `
const MemoizedGrid = React.memo(({ filteredLicitaciones, onSelectLicitacionAI, onAddPostulacion, setAlertModalItem }: any) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {filteredLicitaciones.slice(0, 100).map((item: any) => {
        const expired = isItemExpired(item);
        const fc = extractFechaCierre(item) || item.fechaCierre;
        const timeInfo = calculateChileRemainingTime(fc);

        return (
          <div
            key={item.codigo}
            className={\`bg-white rounded-2xl border shadow-sm hover:shadow-md transition flex flex-col justify-between overflow-hidden relative \${
              expired ? 'border-red-300 bg-red-50/20' : 'border-slate-200 hover:border-blue-400'
            }\`}
          >
            <div className={\`h-1.5 \${expired ? 'bg-red-500' : 'bg-gradient-to-r from-blue-500 to-cyan-500'}\`} />

            <div className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="bg-slate-900 text-white font-mono text-xs font-bold px-2 py-0.5 rounded">
                    {cleanOfficialId(item.codigo)}
                  </span>
                  <span
                    className={\`text-xs font-semibold px-2 py-0.5 rounded \${
                      item.tipo.includes('Directo') || item.tipo.includes('Cotiza')
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-emerald-100 text-emerald-700'
                    }\`}
                  >
                    {item.tipo}
                  </span>
                </div>
              </div>

              <div>
                <h3 className="font-bold text-slate-900 leading-snug line-clamp-2" title={item.nombre}>
                  {cleanTextPrefixes(item.nombre)}
                </h3>
              </div>

              <div className="text-xs space-y-2 text-slate-600 border-t border-slate-100 pt-3">
                <div className="flex items-start justify-between">
                  <span className="font-medium text-slate-500 w-16 shrink-0">Cliente:</span>
                  <span className="font-semibold text-slate-800 truncate max-w-[180px]">
                    {item.cliente}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium">Cierre CLT:</span>
                  <span className={\`font-mono font-bold \${expired ? 'text-red-600' : 'text-slate-900'}\`}>
                    {formatChileDateTime(fc)}
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setAlertModalItem(item)}
                  className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg border border-slate-200 transition text-xs font-bold"
                  title="Crear Alerta"
                >
                  <Bell className="w-3.5 h-3.5 text-amber-600" />
                </button>
                <a
                  href={getItemOfficialUrl(item)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg border border-slate-200 transition text-xs font-bold flex items-center space-x-1"
                  title="Ver Ficha Oficial"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ficha</span>
                </a>
              </div>

              <div className="flex items-center space-x-1.5">
                <button
                  onClick={() => onSelectLicitacionAI(item)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg shadow-xs transition"
                >
                  Evaluar IA
                </button>
                {!expired && (
                  <button
                    onClick={() => onAddPostulacion(item)}
                    className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg transition"
                  >
                    + Postular
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
});

const MemoizedTable = React.memo(({ filteredLicitaciones, onSelectLicitacionAI, openAiEvaluator, onAddPostulacion, setAlertModalItem }: any) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase tracking-wider text-[11px]">
              <th className="py-3 px-4">Código ID</th>
              <th className="py-3 px-4">Nombre Requerimiento</th>
              <th className="py-3 px-4">Cliente</th>
              <th className="py-3 px-4">Tipo</th>
              <th className="py-3 px-4">F. Cierre (Chile CLT)</th>
              <th className="py-3 px-4 text-center">Estado / Restante</th>
              <th className="py-3 px-4 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredLicitaciones.slice(0, 100).map((item: any) => {
              const expired = isItemExpired(item);
              const fc = extractFechaCierre(item) || item.fechaCierre;
              const timeInfo = calculateChileRemainingTime(fc);

              return (
                <tr key={item.codigo} className={\`hover:bg-slate-50 transition \${expired ? 'bg-red-50/20' : ''}\`}>
                  <td className="py-3 px-4 font-mono font-bold text-slate-900 whitespace-nowrap">
                    <span className="bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                      {cleanOfficialId(item.codigo)}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-semibold text-slate-800 max-w-xs sm:max-w-md">
                    <p className="line-clamp-2">{cleanTextPrefixes(item.nombre)}</p>
                  </td>
                  <td className="max-w-[220px] truncate pr-4 text-slate-700 font-medium">
                    {item.cliente}
                  </td>
                  <td className="w-[120px] text-left whitespace-nowrap">
                    <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-100 text-emerald-700">
                      {item.tipo}
                    </span>
                  </td>
                  <td className={\`py-3 px-4 whitespace-nowrap font-mono font-semibold \${expired ? 'text-red-600' : 'text-slate-800'}\`}>
                    {formatChileDateTime(fc)}
                  </td>
                  <td className="py-3 px-4 text-center whitespace-nowrap">
                    {expired ? (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-600 border border-red-500/20">
                        🔴 VENCIDA (Cerrada)
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        ⏳ {timeInfo.badgeText}
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-1.5">
                      <a
                        href={getItemOfficialUrl(item)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-1 rounded-lg border border-slate-200 transition text-[11px]"
                      >
                        Ficha
                      </a>
                      <button
                        onClick={() => {
                          if (onSelectLicitacionAI) {
                            onSelectLicitacionAI(item);
                          } else if (openAiEvaluator) {
                            openAiEvaluator(item);
                          }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-2 py-1 rounded-lg transition text-[11px]"
                      >
                        Evaluar IA
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAlertModalItem(item);
                        }}
                        className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-md text-xs font-bold transition-colors"
                      >
                        🔔 Alerta
                      </button>
                      {!expired && (
                        <button
                          onClick={() => onAddPostulacion?.(item)}
                          className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-2 py-1 rounded-lg transition text-[11px]"
                        >
                          + Postular
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
});
`;

const exportIndex = lines.findIndex(line => line.includes("export const LicitacionesRadarView"));
lines.splice(exportIndex, 0, components);

const gridStartIndex = lines.findIndex(line => line.includes("{viewMode === 'grid' ? ("));
const alertModalIndex = lines.findIndex(line => line.includes("{/* Create Alert Modal */}"));
const tableEndIndex = alertModalIndex - 1; 

const replacedInner = `
      {viewMode === 'grid' ? (
        <MemoizedGrid filteredLicitaciones={filteredLicitaciones} onSelectLicitacionAI={onSelectLicitacionAI} onAddPostulacion={onAddPostulacion} setAlertModalItem={setAlertModalItem} />
      ) : (
        <MemoizedTable filteredLicitaciones={filteredLicitaciones} onSelectLicitacionAI={onSelectLicitacionAI} openAiEvaluator={openAiEvaluator} onAddPostulacion={onAddPostulacion} setAlertModalItem={setAlertModalItem} />
      )}
`;

lines.splice(gridStartIndex, (tableEndIndex - gridStartIndex + 1), replacedInner);

fs.writeFileSync('src/components/LicitacionesRadarView.tsx', lines.join('\n'));
