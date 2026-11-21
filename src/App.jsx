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
      ...
