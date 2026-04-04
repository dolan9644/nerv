// Avatar imports
import misato from './assets/avatars/misato.png';
import seele from './assets/avatars/seele.png';
import ritsuko from './assets/avatars/ritsuko.png';
import shinji from './assets/avatars/shinji.png';
import rei from './assets/avatars/rei.png';
import asuka from './assets/avatars/asuka.png';
import kaworu from './assets/avatars/kaworu.png';
import mari from './assets/avatars/mari.png';
import gendo from './assets/avatars/gendo.png';
import eva01 from './assets/avatars/eva01.png';
import eva02 from './assets/avatars/eva02.png';
import eva03 from './assets/avatars/eva03.png';
import eva00 from './assets/avatars/eva00.png';
import eva13 from './assets/avatars/eva13.png';
import evaSeries from './assets/avatars/eva-series.png';

export const AVATARS = {
  'nerv-misato': misato,
  'nerv-seele': seele,
  'nerv-ritsuko': ritsuko,
  'nerv-shinji': shinji,
  'nerv-rei': rei,
  'nerv-asuka': asuka,
  'nerv-kaworu': kaworu,
  'nerv-mari': mari,
  'nerv-gendo': gendo,
  'nerv-eva01': eva01,
  'nerv-eva02': eva02,
  'nerv-eva03': eva03,
  'nerv-eva00': eva00,
  'nerv-eva13': eva13,
  'nerv-eva-series': evaSeries,
};

export const AGENTS = [
  { id: 'nerv-misato',     name: '葛城美里',   role: 'COMMANDER',  layer: 'command',       emoji: '🎯' },
  { id: 'nerv-seele',      name: 'SEELE',      role: 'OVERSIGHT',  layer: 'command',       emoji: '🔒' },
  { id: 'nerv-ritsuko',    name: '赤木律子',   role: 'CODE ORCH',  layer: 'orchestration', emoji: '🔬' },
  { id: 'nerv-shinji',     name: '碇真嗣',     role: 'DATA ORCH',  layer: 'orchestration', emoji: '⚡' },
  { id: 'nerv-rei',        name: '绫波零',     role: 'KNOWLEDGE',  layer: 'orchestration', emoji: '🌙' },
  { id: 'nerv-asuka',      name: '式波明日香', role: 'DEBUGGER',   layer: 'frontline',     emoji: '🔥' },
  { id: 'nerv-kaworu',     name: '渚薰',       role: 'OPTIMIZER',  layer: 'frontline',     emoji: '🎵' },
  { id: 'nerv-eva01',      name: 'EVA-01',     role: 'DEPLOYER',   layer: 'frontline',     emoji: '🛠️' },
  { id: 'nerv-mari',       name: '真希波',     role: 'CRAWLER',    layer: 'frontline',     emoji: '🕷️' },
  { id: 'nerv-eva02',      name: 'EVA-02',     role: 'MONITOR',    layer: 'frontline',     emoji: '📡' },
  { id: 'nerv-eva03',      name: 'EVA-03',     role: 'SEARCHER',   layer: 'frontline',     emoji: '🔍' },
  { id: 'nerv-eva00',      name: 'EVA-00',     role: 'CLEANSER',   layer: 'frontline',     emoji: '🧹' },
  { id: 'nerv-eva13',      name: 'EVA-13',     role: 'WRITER',     layer: 'frontline',     emoji: '✍️' },
  { id: 'nerv-gendo',      name: '碇源堂',     role: 'STRATEGIST', layer: 'command',       emoji: '👤' },
  { id: 'nerv-eva-series', name: '量産機',     role: 'VISUAL',     layer: 'frontline',     emoji: '🎨' },
];

export const LAYER_LABELS = {
  command: '指挥層 COMMAND',
  orchestration: '編排層 ORCHESTRATION',
  frontline: '作戰層 FRONTLINE',
};

export const LAYER_COLORS = {
  command: 'var(--nerv-orange)',
  orchestration: 'var(--nerv-cyan)',
  frontline: 'var(--nerv-green)',
};
