import { LEVELS } from '../levels.js';

export type HeroGender = 'boy' | 'girl';

export type GameState = 'MENU' | 'INTRO' | 'CHOOSING' | 'ANSWERED' | 'END';

export type AnswerStatus = 'correct' | 'wrong' | null;

export interface LevelOption {
  id: string;
  emoji: string;
  text: string;
  isCorrect: boolean;
}

export interface LevelData {
  id: number;
  lessonNumber: number;
  lessonName: string;
  scene: string;
  question: string;
  options: LevelOption[];
  tip: string;
  buildingKey: string;
  buildingName: string;
}

export interface DistrictInfo {
  id: number;
  key: string;
  name: string;
  emoji: string;
  color: number;
  cssColor: string;
  position: [number, number, number]; // x, y, z
  heroSpot: [number, number, number]; // where hero lands next to pad
}

export const DISTRICTS: DistrictInfo[] = [
  {
    id: 1,
    key: 'market',
    name: 'Market',
    emoji: '🍞',
    color: 0xff9f1c,
    cssColor: '#ff9f1c',
    position: [7.2, 0.1, 0],
    heroSpot: [5.6, 0.1, 0],
  },
  {
    id: 2,
    key: 'work',
    name: 'Work',
    emoji: '👷',
    color: 0x2ec4b6,
    cssColor: '#2ec4b6',
    position: [2.2, 0.1, 6.9],
    heroSpot: [1.8, 0.1, 5.3],
  },
  {
    id: 3,
    key: 'housing',
    name: 'Housing',
    emoji: '🏠',
    color: 0xff5d8f,
    cssColor: '#ff5d8f',
    position: [-5.8, 0.1, 4.2],
    heroSpot: [-4.5, 0.1, 3.2],
  },
  {
    id: 4,
    key: 'town',
    name: 'Town',
    emoji: '🏛️',
    color: 0x9b5de5,
    cssColor: '#9b5de5',
    position: [-5.8, 0.1, -4.2],
    heroSpot: [-4.5, 0.1, -3.2],
  },
  {
    id: 5,
    key: 'harbor',
    name: 'Harbor',
    emoji: '⛵',
    color: 0x00b4d8,
    cssColor: '#00b4d8',
    position: [2.2, 0.1, -6.9],
    heroSpot: [1.8, 0.1, -5.3],
  },
  {
    id: 6,
    key: 'bank',
    name: 'Bank',
    emoji: '🏦',
    color: 0xeab308,
    cssColor: '#eab308',
    position: [5.8, 0.1, 4.2],
    heroSpot: [4.4, 0.1, 3.2],
  },
  {
    id: 7,
    key: 'skyscraper',
    name: 'Tower',
    emoji: '🏢',
    color: 0x06b6d4,
    cssColor: '#06b6d4',
    position: [-7.2, 0.1, 0.0],
    heroSpot: [-5.6, 0.1, 0.0],
  },
  {
    id: 8,
    key: 'park',
    name: 'Park',
    emoji: '🌳',
    color: 0x10b981,
    cssColor: '#10b981',
    position: [-2.2, 0.1, -6.8],
    heroSpot: [-1.8, 0.1, -5.2],
  },
  {
    id: 9,
    key: 'clocktower',
    name: 'Clock Tower',
    emoji: '🕰️',
    color: 0xf97316,
    cssColor: '#f97316',
    position: [5.8, 0.1, -4.2],
    heroSpot: [4.4, 0.1, -3.2],
  },
];

export { LEVELS };
