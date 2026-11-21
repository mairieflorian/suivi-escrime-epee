import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  CheckCircle2,
  XCircle,
  Grid,
  Trophy,
  Download,
  Upload,
  Plus,
  RotateCcw,
  MapPin,
  Search,
  Shuffle,
} from 'lucide-react';
import { INITIAL_EVENTS, EVENT_ORDER } from './data/initialEvents';

const STORAGE_KEY = 'escrime_epee_competition_v1';

function computePoolStats(pool) {
  const stats = {};
  pool.fencers.forEach((f) => {
    stats[f.id] = {
      fencer: f,
      matches: 0,
      victories: 0,
      td: 0,
      tr: 0,
    };
  });

  const n = pool.fencers.length;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const fA = pool.fencers[i];
      const fB = pool.fencers[j];
      const key = `${fA.id}_${fB.id}`;
      const match = pool.scores?.[key];
      if (match && match.a !== '' && match.b !== '' && match.a !== undefined && match.b !== undefined) {
        const sA = Number(match.a);
        const sB = Number(match.b);
        if (!Number.isNaN(sA) && !Number.isNaN(sB)) {
          stats[fA.id].matches += 1;
          stats[fB.id].matches += 1;
          stats[fA.id].td += sA;
          stats[fA.id].tr += sB;
          stats[fB.id].td += sB;
          stats[fB.id].tr += sA;
          if (sA > sB) stats[fA.id].victories += 1;
          else if (sB > sA) stats[fB.id].victories += 1;
        }
      }
    }
  }

  return Object.values(stats)
    .map((s) => ({
      ...s,
      ratio: s.matches > 0 ? s.victories / s.matches : 0,
      index: s.td - s.tr,
    }))
    .sort((a, b) => {
      if (b.ratio !== a.ratio) return b.ratio - a.ratio;
      if (b.index !== a.index) return b.index - a.index;
      return b.td - a.td;
    });
}

function getSeedingOrder(size) {
  let seeds = [1, 2];
  while (seeds.length < size) {
    const nextSize = seeds.length * 2;
    const nextSeeds = [];
    for (const s of seeds) {
      nextSeeds.push(s);
      nextSeeds.push(nextSize + 1 - s);
    }
    seeds = nextSeeds;
  }
  return seeds;
}

function getRoundName(size) {
  if (size === 2) return 'Finale';
  if (size === 4) return 'Demi-finales';
  if (size === 8) return 'Quarts de finale';
  if (size === 16) return 'Tableau de 16';
  if (size === 32) return 'Tableau de 32';
  if (size === 64) return 'Tableau de 64';
  return `Tableau de ${size}`;
}

export default function App() {
  const [events, setEvents] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : INITIAL_EVENTS;
    } catch {
      return INITIAL_EVENTS;
    }
  });

  const [activeEventId, setActiveEventId] = useState('M11_MIXTE');
  const [activeTab, setActiveTab] = useState('inscrits');
  const [searchQuery, setSearchQuery] = useState('');
  const [poolCount, setPoolCount] = useState(3);
  const [newFencer, setNewFencer] = useState({ nom: '', prenom: '', club: '', licence: '' });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
    } catch (e) {
      console.error('Erreur sauvegarde localStorage:', e);
    }
  }, [events]);

  const currentEvent = events[activeEventId];

  const filteredFencers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return currentEvent.fencers;
    return currentEvent.fencers.filter(
      (f) =>
        f.nom.toLowerCase().includes(q) ||
        f.prenom.toLowerCase().includes(q) ||
        f.club.toLowerCase().includes(q) ||
        (f.licence && f.licence.includes(q))
    );
  }, [currentEvent.fencers, searchQuery]);

  const presentFencers = useMemo(
    () => currentEvent.fencers.filter((f) => f.present),
    [currentEvent.fencers]
  );

  const overallPoolRanking = useMemo(() => {
    if (!currentEvent.pools || currentEvent.pools.length === 0) return [];
    const allStats = currentEvent.pools.flatMap((p) => computePoolStats(p));
    return allStats.sort((a, b) => {
      if (b.ratio !== a.ratio) return b.ratio - a.ratio;
      if (b.index !== a.index) return b.index - a.index;
      return b.td - a.td;
    });
  }, [currentEvent.pools]);

  const togglePresence = (fencerId) => {
    setEvents((prev) => ({
      ...prev,
      [activeEventId]: {
        ...prev[activeEventId],
        fencers: prev[activeEventId].fencers.map((f) =>
          f.id === fencerId ? { ...f, present: !f.present } : f
        ),
      },
    }));
  };

  const setAllPresence = (isPresent) => {
    setEvents((prev) => ({
      ...prev,
      [activeEventId]: {
        ...prev[activeEventId],
        fencers: prev[activeEventId].fencers.map((f) => ({ ...f, present: isPresent })),
      },
    }));
  };

  const handleAddFencer = (e) => {
    e.preventDefault();
    if (!newFencer.nom.trim() || !newFencer.prenom.trim()) return;
    const fencerObj = {
      id: newFencer.licence.trim() || `CUSTOM_${Date.now()}`,
      nom: newFencer.nom.trim().toUpperCase(),
      prenom: newFencer.prenom.trim(),
      naissance: '',
      sexe: '',
      club: newFencer.club.trim().toUpperCase() || 'INDIVIDUEL',
      classement: 0,
      licence: newFencer.licence.trim() || '-',
      present: true,
    };
    setEvents((prev) => ({
      ...prev,
      [activeEventId]: {
        ...prev[activeEventId],
        fencers: [...prev[activeEventId].fencers, fencerObj],
      },
    }));
    setNewFencer({ nom: '', prenom: '', club: '', licence: '' });
  };

  const handleCsvUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result;
      if (typeof text !== 'string') return;
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      const imported = [];
      lines.forEach((line, idx) => {
        const sep = line.includes(';') ? ';' : ',';
        const parts = line.split(sep).map((s) => s.trim().replace(/^"|"$/g, ''));
        if (idx === 0 && parts[0].toLowerCase().includes('nom')) return;
        if (parts[0] && parts[1]) {
          imported.push({
            id: parts[3] || `IMP_${Date.now()}_${idx}`,
            nom: parts[0].toUpperCase(),
            prenom: parts[1],
            naissance: '',
            sexe: '',
            club: (parts[2] || 'INDIVIDUEL').toUpperCase(),
            classement: 0,
            licence: parts[3] || '-',
            present: true,
          });
        }
      });
      if (imported.length > 0) {
        setEvents((prev) => ({
          ...prev,
          [activeEventId]: {
            ...prev[activeEventId],
            fencers: imported,
            pools: [],
            bracket: [],
          },
        }));
        alert(`${imported.length} tireurs importés dans ${currentEvent.shortLabel}.`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const generatePools = () => {
    if (presentFencers.length < 3) {
      alert('Il faut au moins 3 tireurs présents pour générer des poules.');
      return;
    }
    const count = Math.max(1, Math.min(Number(poolCount) || 1, Math.floor(presentFencers.length / 2)));
    const sortedByClub = [...presentFencers].sort((a, b) => a.club.localeCompare(b.club));

    const buckets = Array.from({ length: count }, (_, idx) => ({
      id: `POOL_${idx + 1}`,
      number: idx + 1,
      piste: `${idx + 1}`,
      fencers: [],
      scores: {},
    }));

    sortedByClub.forEach((fencer, idx) => {
      const cycle = Math.floor(idx / count);
      const pos = cycle % 2 === 0 ? idx % count : count - 1 - (idx % count);
      buckets[pos].fencers.push(fencer);
    });

    setEvents((prev) => ({
      ...prev,
      [activeEventId]: {
        ...prev[activeEventId],
        pools: buckets,
      },
    }));
    setActiveTab('poules');
  };

  const updatePoolPiste = (poolId, piste) => {
    setEvents((prev) => ({
      ...prev,
      [activeEventId]: {
        ...prev[activeEventId],
        pools: prev[activeEventId].pools.map((p) =>
          p.id === poolId ? { ...p, piste } : p
        ),
      },
    }));
  };

  const updatePoolScore = (poolId, fAId, fBId, valA, valB) => {
    setEvents((prev) => ({
      ...prev,
      [activeEventId]: {
        ...prev[activeEventId],
        pools: prev[activeEventId].pools.map((p) => {
          if (p.id !== poolId) return p;
          const key = `${fAId}_${fBId}`;
          const current = p.scores?.[key] || { a: '', b: '' };
          return {
            ...p,
            scores: {
              ...p.scores,
              [key]: {
                a: valA !== undefined ? valA : current.a,
                b: valB !== undefined ? valB : current.b,
              },
            },
          };
        }),
      },
    }));
  };

  const generateBracket = () => {
    const ranked = overallPoolRanking.length > 0
      ? overallPoolRanking.map((r, i) => ({ ...r.fencer, seed: i + 1 }))
      : presentFencers.map((f, i) => ({ ...f, seed: i + 1 }));

    if (ranked.length < 2) {
      alert('Il faut au moins 2 tireurs pour créer le tableau éliminatoire.');
      return;
    }

    let size = 2;
    while (size < ranked.length) size *= 2;

    const seedingOrder = getSeedingOrder(size);
    const firstRoundMatches = [];

    for (let i = 0; i < size; i += 2) {
      const seed1 = seedingOrder[i];
      const seed2 = seedingOrder[i + 1];
      const f1 = ranked[seed1 - 1] || null;
      const f2 = ranked[seed2 - 1] || null;
      const isBye = f1 && !f2;

      firstRoundMatches.push({
        id: `R${size}_M${i / 2 + 1}`,
        piste: '',
        f1,
        f2,
        score1: '',
        score2: '',
        winner: isBye ? f1 : null,
      });
    }

    const rounds = [{ size, name: getRoundName(size), matches: firstRoundMatches }];
    let currentSize = size / 2;
    while (currentSize >= 2) {
      const prevMatches = rounds[rounds.length - 1].matches;
      const matches = [];
      for (let i = 0; i < currentSize / 2; i++) {
        const m1 = prevMatches[i * 2];
        const m2 = prevMatches[i * 2 + 1];
        matches.push({
          id: `R${currentSize}_M${i + 1}`,
          piste: '',
          f1: m1?.winner || null,
          f2: m2?.winner || null,
          score1: '',
          score2: '',
          winner: null,
        });
      }
      rounds.push({ size: currentSize, name: getRoundName(currentSize), matches });
      currentSize /= 2;
    }

    setEvents((prev) => ({
      ...prev,
      [activeEventId]: {
        ...prev[activeEventId],
        bracket: rounds,
      },
    }));
    setActiveTab('tableau');
  };

  const updateBracketMatch = (roundIdx, matchIdx, field, value) => {
    setEvents((prev) => {
      const rounds = JSON.parse(JSON.stringify(prev[activeEventId].bracket));
      const match = rounds[roundIdx].matches[matchIdx];
      match[field] = value;

      if (field === 'score1' || field === 'score2') {
        const s1 = match.score1 !== '' ? Number(match.score1) : null;
        const s2 = match.score2 !== '' ? Number(match.score2) : null;

        if (match.f1 && !match.f2) {
          match.winner = match.f1;
        } else if (s1 !== null && s2 !== null && !Number.isNaN(s1) && !Number.isNaN(s2) && s1 !== s2) {
          match.winner = s1 > s2 ? match.f1 : match.f2;
        } else {
          match.winner = null;
        }

        for (let r = roundIdx; r < rounds.length - 1; r++) {
          const nextRound = rounds[r + 1];
          for (let m = 0; m < nextRound.matches.length; m++) {
            const source1 = rounds[r].matches[m * 2];
            const source2 = rounds[r].matches[m * 2 + 1];
            const target = nextRound.matches[m];
            target.f1 = source1?.winner || null;
            target.f2 = source2?.winner || null;
            if (!target.f1 || !target.f2) {
              target.winner = null;
            } else if (target.score1 !== '' && target.score2 !== '') {
              const ns1 = Number(target.score1);
              const ns2 = Number(target.score2);
              target.winner = ns1 > ns2 ? target.f1 : ns2 > ns1 ? target.f2 : null;
            }
          }
        }
      }

      return {
        ...prev,
        [activeEventId]: {
          ...prev[activeEventId],
          bracket: rounds,
        },
      };
    });
  };

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `competition-epee-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result);
        setEvents(parsed);
        alert('Sauvegarde restaurée avec succès.');
      } catch {
        alert('Fichier JSON invalide.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetAll = () => {
    if (window.confirm('Réinitialiser toutes les données aux listes initiales ?')) {
      setEvents(INITIAL_EVENTS);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-slate-900 text-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Suivi Compétition Escrime — Épée</h1>
            <p className="text-xs text-slate-400">7 Épreuves • Appel, Poules, Pistes & Tableau Éliminatoire</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={exportJson}
              className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-xs px-3 py-2 rounded-lg border border-slate-700"
            >
              <Download className="w-4 h-4" /> Sauvegarder JSON
            </button>
            <label className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-xs px-3 py-2 rounded-lg border border-slate-700 cursor-pointer">
              <Upload className="w-4 h-4" /> Charger JSON
              <input type="file" accept=".json" onChange={importJson} className="hidden" />
            </label>
            <button
              onClick={resetAll}
              className="flex items-center gap-1.5 bg-rose-950 hover:bg-rose-900 text-rose-200 text-xs px-3 py-2 rounded-lg border border-rose-800"
            >
              <RotateCcw className="w-4 h-4" /> Réinitialiser
            </button>
          </div>
        </div>

        <div className="bg-slate-800 border-t border-slate-700">
          <div className="max-w-7xl mx-auto px-4 py-2 flex gap-2 overflow-x-auto">
            {EVENT_ORDER.map((id) => {
              const ev = events[id];
              const isSelected = id === activeEventId;
              return (
                <button
                  key={id}
                  onClick={() => setActiveEventId(id)}
                  className={`px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 font-semibold shadow'
                      : 'bg-slate-900/60 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {ev.shortLabel}{' '}
                  <span className={`ml-1 text-xs ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                    ({ev.fencers.length})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2 py-2">
          <div className="flex gap-1 sm:gap-2">
            {[
              { id: 'inscrits', label: '1. Inscrits', icon: Users, count: currentEvent.fencers.length },
              { id: 'appel', label: '2. Appel', icon: CheckCircle2, count: `${presentFencers.length}/${currentEvent.fencers.length}` },
              { id: 'poules', label: '3. Poules', icon: Grid, count: currentEvent.pools.length },
              { id: 'tableau', label: '4. Tableau', icon: Trophy, count: currentEvent.bracket.length > 0 ? `T${currentEvent.bracket[0].size}` : 0 },
            ].map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg text-sm font-medium transition ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${active ? 'bg-slate-700 text-slate-200' : 'bg-slate-200 text-slate-700'}`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="text-sm font-semibold text-slate-700">{currentEvent.label}</div>
        </div>
      </div>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">
        {activeTab === 'inscrits' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Rechercher par nom, prénom, club ou licence..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <label className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-medium px-4 py-2 rounded-lg cursor-pointer">
                <Upload className="w-4 h-4" /> Importer CSV (Nom;Prénom;Club;Licence)
                <input type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="hidden" />
              </label>
            </div>

            <form onSubmit={handleAddFencer} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 sm:grid-cols-5 gap-3">
              <input
                type="text"
                placeholder="NOM"
                value={newFencer.nom}
                onChange={(e) => setNewFencer({ ...newFencer, nom: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Prénom"
                value={newFencer.prenom}
                onChange={(e) => setNewFencer({ ...newFencer, prenom: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
                required
              />
              <input
                type="text"
                placeholder="Club"
                value={newFencer.club}
                onChange={(e) => setNewFencer({ ...newFencer, club: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="N° Licence"
                value={newFencer.licence}
                onChange={(e) => setNewFencer({ ...newFencer, licence: e.target.value })}
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
              />
              <button
                type="submit"
                className="flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm px-4 py-2 rounded-lg"
              >
                <Plus className="w-4 h-4" /> Ajouter tireur
              </button>
            </form>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-100 text-slate-600 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">#</th>
                      <th className="px-4 py-3">Nom</th>
                      <th className="px-4 py-3">Prénom</th>
                      <th className="px-4 py-3">Club</th>
                      <th className="px-4 py-3">Naissance</th>
                      <th className="px-4 py-3">Licence</th>
                      <th className="px-4 py-3">Statut Appel</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredFencers.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                          Aucun tireur inscrit pour cette épreuve. Ajoutez-en manuellement ou importez un fichier CSV.
                        </td>
                      </tr>
                    ) : (
                      filteredFencers.map((f, idx) => (
                        <tr key={f.id} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 text-slate-400">{idx + 1}</td>
                          <td className="px-4 py-2.5 font-semibold">{f.nom}</td>
                          <td className="px-4 py-2.5">{f.prenom}</td>
                          <td className="px-4 py-2.5 text-slate-600">{f.club}</td>
                          <td className="px-4 py-2.5 text-slate-500">{f.naissance || '-'}</td>
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{f.licence}</td>
                          <td className="px-4 py-2.5">
                            {f.present ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                Présent
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-800">
                                Absent
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'appel' && (
          <div className="space-y-6">
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="text-sm">
                  <span className="font-bold text-emerald-600 text-lg">{presentFencers.length}</span> présents /{' '}
                  <span className="font-semibold">{currentEvent.fencers.length}</span> inscrits
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setAllPresence(true)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium"
                  >
                    Tout cocher présent
                  </button>
                  <button
                    onClick={() => setAllPresence(false)}
                    className="text-xs px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium"
                  >
                    Tout cocher absent
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm text-slate-600 flex items-center gap-2">
                  Nombre de poules :
                  <input
                    type="number"
                    min="1"
                    max="15"
                    value={poolCount}
                    onChange={(e) => setPoolCount(e.target.value)}
                    className="w-16 border border-slate-300 rounded-lg px-2 py-1.5 text-center font-semibold"
                  />
                </label>
                <button
                  onClick={generatePools}
                  className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-4 py-2 rounded-lg"
                >
                  <Shuffle className="w-4 h-4" /> Générer les poules
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {currentEvent.fencers.map((f) => (
                <button
                  key={f.id}
                  onClick={() => togglePresence(f.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition ${
                    f.present
                      ? 'bg-white border-emerald-300 shadow-sm'
                      : 'bg-rose-50/60 border-rose-200 opacity-75'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-sm">
                      {f.nom} <span className="font-normal">{f.prenom}</span>
                    </div>
                    <div className="text-xs text-slate-500">{f.club}</div>
                  </div>
                  {f.present ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                      <CheckCircle2 className="w-5 h-5" /> Présent
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-600 font-semibold text-xs">
                      <XCircle className="w-5 h-5" /> Absent
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'poules' && (
          <div className="space-y-8">
            {currentEvent.pools.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-3">
                <p className="text-slate-600">Aucune poule générée pour le moment.</p>
                <button
                  onClick={() => setActiveTab('appel')}
                  className="bg-slate-900 text-white text-sm px-4 py-2 rounded-lg"
                >
                  Aller à l'appel pour générer les poules
                </button>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                  <div className="text-sm text-slate-600">
                    Saisissez les scores des matchs et indiquez le <strong>numéro de piste</strong> pour chaque poule.
                  </div>
                  <button
                    onClick={generateBracket}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
                  >
                    <Trophy className="w-4 h-4" /> Générer le tableau éliminatoire
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {currentEvent.pools.map((pool) => {
                    const poolRanking = computePoolStats(pool);
                    return (
                      <div key={pool.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="bg-slate-900 text-white px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-bold">Poule n°{pool.number}</h3>
                          <div className="flex items-center gap-2 bg-slate-800 px-3 py-1 rounded-lg border border-slate-700">
                            <MapPin className="w-4 h-4 text-emerald-400" />
                            <span className="text-xs text-slate-300">Piste :</span>
                            <input
                              type="text"
                              value={pool.piste}
                              onChange={(e) => updatePoolPiste(pool.id, e.target.value)}
                              placeholder="N°"
                              className="w-16 bg-slate-900 text-white text-sm font-bold text-center rounded px-1.5 py-0.5 border border-slate-600 focus:outline-none focus:border-emerald-400"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                          <div className="lg:col-span-7 p-4 space-y-2">
                            <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">Matchs de la poule</h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {pool.fencers.map((fA, i) =>
                                pool.fencers.slice(i + 1).map((fB) => {
                                  const key = `${fA.id}_${fB.id}`;
                                  const sc = pool.scores?.[key] || { a: '', b: '' };
                                  return (
                                    <div
                                      key={key}
                                      className="flex items-center justify-between gap-2 bg-slate-50 p-2 rounded-lg border border-slate-200 text-xs"
                                    >
                                      <span className="truncate flex-1 font-medium" title={`${fA.nom} ${fA.prenom}`}>
                                        {fA.nom}
                                      </span>
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          min="0"
                                          max="15"
                                          value={sc.a}
                                          onChange={(e) => updatePoolScore(pool.id, fA.id, fB.id, e.target.value, undefined)}
                                          className="w-11 text-center border border-slate-300 rounded py-1 font-bold bg-white"
                                        />
                                        <span className="text-slate-400">-</span>
                                        <input
                                          type="number"
                                          min="0"
                                          max="15"
                                          value={sc.b}
                                          onChange={(e) => updatePoolScore(pool.id, fA.id, fB.id, undefined, e.target.value)}
                                          className="w-11 text-center border border-slate-300 rounded py-1 font-bold bg-white"
                                        />
                                      </div>
                                      <span className="truncate flex-1 text-right font-medium" title={`${fB.nom} ${fB.prenom}`}>
                                        {fB.nom}
                                      </span>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>

                          <div className="lg:col-span-5 p-4 overflow-x-auto">
                            <h4 className="text-xs font-semibold uppercase text-slate-500 mb-2">Classement Poule {pool.number}</h4>
                            <table className="w-full text-xs text-left">
                              <thead className="text-slate-500 border-b border-slate-200">
                                <tr>
                                  <th className="py-1.5">#</th>
                                  <th className="py-1.5">Tireur</th>
                                  <th className="py-1.5 text-center">V/M</th>
                                  <th className="py-1.5 text-center">TD</th>
                                  <th className="py-1.5 text-center">TR</th>
                                  <th className="py-1.5 text-center">Ind.</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {poolRanking.map((row, rIdx) => (
                                  <tr key={row.fencer.id}>
                                    <td className="py-1.5 font-semibold text-slate-500">{rIdx + 1}</td>
                                    <td className="py-1.5 font-medium">
                                      {row.fencer.nom} <span className="text-slate-500">{row.fencer.prenom}</span>
                                    </td>
                                    <td className="py-1.5 text-center font-semibold">
                                      {row.victories}/{row.matches}
                                    </td>
                                    <td className="py-1.5 text-center">{row.td}</td>
                                    <td className="py-1.5 text-center">{row.tr}</td>
                                    <td className={`py-1.5 text-center font-bold ${row.index >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {row.index > 0 ? `+${row.index}` : row.index}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {overallPoolRanking.length > 0 && (
                  <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="bg-slate-100 px-4 py-3 border-b border-slate-200 font-bold text-sm">
                      Classement intermédiaire général (issue des poules)
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-xs text-slate-500 uppercase">
                          <tr>
                            <th className="px-4 py-2">Rang</th>
                            <th className="px-4 py-2">Tireur</th>
                            <th className="px-4 py-2">Club</th>
                            <th className="px-4 py-2 text-center">V/M</th>
                            <th className="px-4 py-2 text-center">Ratio</th>
                            <th className="px-4 py-2 text-center">Indice</th>
                            <th className="px-4 py-2 text-center">TD</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {overallPoolRanking.map((row, i) => (
                            <tr key={row.fencer.id}>
                              <td className="px-4 py-2 font-bold">{i + 1}</td>
                              <td className="px-4 py-2 font-medium">
                                {row.fencer.nom} {row.fencer.prenom}
                              </td>
                              <td className="px-4 py-2 text-slate-500">{row.fencer.club}</td>
                              <td className="px-4 py-2 text-center">
                                {row.victories}/{row.matches}
                              </td>
                              <td className="px-4 py-2 text-center font-mono">{row.ratio.toFixed(2)}</td>
                              <td className="px-4 py-2 text-center font-bold">
                                {row.index > 0 ? `+${row.index}` : row.index}
                              </td>
                              <td className="px-4 py-2 text-center">{row.td}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'tableau' && (
          <div className="space-y-6">
            {currentEvent.bracket.length === 0 ? (
              <div className="bg-white p-8 rounded-xl border border-slate-200 text-center space-y-3">
                <p className="text-slate-600">Le tableau éliminatoire n'a pas encore été généré.</p>
                <button
                  onClick={generateBracket}
                  className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg"
                >
                  Générer le tableau maintenant
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-6 min-w-max">
                  {currentEvent.bracket.map((round, rIdx) => (
                    <div key={round.size} className="w-80 space-y-4">
                      <div className="bg-slate-900 text-white px-4 py-2 rounded-lg font-bold text-sm text-center">
                        {round.name}
                      </div>

                      <div className="space-y-4">
                        {round.matches.map((m, mIdx) => {
                          const isBye = m.f1 && !m.f2;
                          return (
                            <div
                              key={m.id}
                              className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
                            >
                              <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-200 flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-500">Match #{mIdx + 1}</span>
                                <div className="flex items-center gap-1.5">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                                  <span className="text-slate-600 font-medium">Piste :</span>
                                  <input
                                    type="text"
                                    value={m.piste}
                                    onChange={(e) => updateBracketMatch(rIdx, mIdx, 'piste', e.target.value)}
                                    placeholder="N°"
                                    className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-center font-bold text-slate-900 focus:outline-none focus:border-emerald-500"
                                  />
                                </div>
                              </div>

                              <div
                                className={`px-3 py-2 flex items-center justify-between gap-2 border-b border-slate-100 ${
                                  m.winner && m.f1 && m.winner.id === m.f1.id ? 'bg-emerald-50 font-bold' : ''
                                }`}
                              >
                                <div className="truncate text-sm">
                                  {m.f1 ? (
                                    <>
                                      <span className="text-xs text-slate-400 mr-1.5">({m.f1.seed})</span>
                                      {m.f1.nom} <span className="font-normal text-xs">{m.f1.prenom}</span>
                                    </>
                                  ) : (
                                    <span className="text-slate-400 italic text-xs">En attente</span>
                                  )}
                                </div>
                                {!isBye && m.f1 && m.f2 && (
                                  <input
                                    type="number"
                                    min="0"
                                    max="15"
                                    value={m.score1}
                                    onChange={(e) => updateBracketMatch(rIdx, mIdx, 'score1', e.target.value)}
                                    className="w-12 text-center border border-slate-300 rounded py-1 text-sm font-bold"
                                  />
                                )}
                              </div>

                              <div
                                className={`px-3 py-2 flex items-center justify-between gap-2 ${
                                  m.winner && m.f2 && m.winner.id === m.f2.id ? 'bg-emerald-50 font-bold' : ''
                                }`}
                              >
                                <div className="truncate text-sm">
                                  {m.f2 ? (
                                    <>
                                      <span className="text-xs text-slate-400 mr-1.5">({m.f2.seed})</span>
                                      {m.f2.nom} <span className="font-normal text-xs">{m.f2.prenom}</span>
                                    </>
                                  ) : isBye ? (
                                    <span className="text-emerald-700 text-xs font-medium">Exempt (Qualifié)</span>
                                  ) : (
                                    <span className="text-slate-400 italic text-xs">En attente</span>
                                  )}
                                </div>
                                {!isBye && m.f1 && m.f2 && (
                                  <input
                                    type="number"
                                    min="0"
                                    max="15"
                                    value={m.score2}
                                    onChange={(e) => updateBracketMatch(rIdx, mIdx, 'score2', e.target.value)}
                                    className="w-12 text-center border border-slate-300 rounded py-1 text-sm font-bold"
                                  />
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}