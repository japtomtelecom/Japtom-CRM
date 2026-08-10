function ModalBoleta({ cliente, empresaNombre, onClose }) {
  const [cantidades, setCantidades] = useState({});
  const [observaciones, setObservaciones] = useState('Puerto óptico en NAP: ');
  const [generando, setGenerando] = useState(false);

  async function generar() {
    setGenerando(true);
    await generarBoletaInstalacion(cliente, cantidades, observaciones, empresaNombre);
    setGenerando(false);
    onClose();
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}
      onClick={onClose}
    >
      <div style={{ background: '#fff', borderRadius: 8, padding: 24, width: 380, maxHeight: '85vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Boleta de instalación</h3>
        <p style={{ fontSize: 13, color: '#666', marginTop: -8 }}>{cliente.nombre} · {cliente.codigo}</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          {MATERIALES.map((mat) => (
            <div key={mat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: 13 }}>{mat}</label>
              <input
                type="number"
                min="0"
                className="input"
                style={{ width: 80 }}
                value={cantidades[mat] || ''}
                onChange={(e) => setCantidades({ ...cantidades, [mat]: e.target.value })}
              />
            </div>
          ))}
        </div>

        <label className="label" style={{ marginTop: 12 }}>Observaciones</label>
        <textarea
          className="input"
          rows={3}
          value={observaciones}
          onChange={(e) => setObservaciones(e.target.value)}
        />

        <div className="flex gap-2 mt-4">
          <button onClick={generar} disabled={generando} className="btn-primary">
            {generando ? 'Generando…' : 'Generar PDF'}
          </button>
          <button onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}