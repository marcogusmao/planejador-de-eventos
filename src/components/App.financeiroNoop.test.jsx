// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { novoEvento } from '../lib/defaults.js';
const bancada = vi.hoisted(() => ({
  store: null,
  saves: []
}));
vi.mock('../lib/storage.js', async real => ({
  ...(await real()),
  loadStore: () => bancada.store,
  saveStore: s => {
    bancada.saves.push(s);
    return {
      ok: true
    };
  },
  estadoLeitura: () => null
}));
vi.mock('../lib/multiAba.js', () => ({
  vigiarOutrasAbas: () => () => {}
}));
vi.mock('./EventEditor.jsx', () => ({
  default: ({
    evento,
    update
  }) => <div><p>{evento.nome}</p><button onClick={() => update(e => e, 'aplicação recusada por assinatura')}>Recusar sem mudar evento</button><button onClick={() => {
      update(e => ({
        ...e,
        status: 'fechado'
      }), 'fechar antes de aplicar');
      update(e => ({
        ...e,
        nome: 'Nunca deve entrar'
      }), 'aplicar revisão vencida');
    }}>Fechar antes de efetivar revisão</button></div>
}));
import App from '../App.jsx';
beforeEach(() => {
  const mapa = new Map();
  vi.stubGlobal('localStorage', {
    getItem: k => mapa.get(k) || null,
    setItem: (k, v) => mapa.set(k, String(v)),
    removeItem: k => mapa.delete(k),
    clear: () => mapa.clear(),
    key: i => [...mapa.keys()][i],
    get length() {
      return mapa.size;
    }
  });
  bancada.store = {
    eventos: [{
      ...novoEvento('Brisa sintética'),
      id: 'ev-s1'
    }],
    benchmarksCustom: [],
    benchmarkOverrides: {},
    benchmarksPadrao: {},
    benchmarksOcultos: [],
    benchmarksApagados: [],
    ajustes: {
      porTipo: {}
    }
  };
  bancada.saves = [];
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const abrir = () => {
  render(<App />);
  fireEvent.click(screen.getByRole('button', {
    name: 'Abrir Brisa sintética'
  }));
};
describe('funil real do App preserva no-op da ponte', () => {
  it('mesma referência não cria carimbo, save ou histórico', () => {
    abrir();
    const antes = bancada.saves.at(-1);
    const n = bancada.saves.length;
    fireEvent.click(screen.getByRole('button', {
      name: 'Recusar sem mudar evento'
    }));
    expect(bancada.saves).toHaveLength(n);
    expect(bancada.saves.at(-1)).toBe(antes);
    fireEvent.keyDown(window, {
      key: 'z',
      metaKey: true
    });
    expect(bancada.saves.at(-1)).toBe(antes);
  });
  it('fechamento enfileirado antes do updater recusa a segunda escrita', () => {
    abrir();
    fireEvent.click(screen.getByRole('button', {
      name: 'Fechar antes de efetivar revisão'
    }));
    expect(bancada.saves.at(-1).eventos[0]).toMatchObject({
      status: 'fechado',
      nome: 'Brisa sintética'
    });
    fireEvent.keyDown(window, {
      key: 'z',
      metaKey: true
    });
    expect(bancada.saves.at(-1).eventos[0].status).not.toBe('fechado');
  });
});
