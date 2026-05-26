import { ExperimentFlow } from '@/lib/types';
import ejercicio1 from './ejercicio-1';
import emociones from './emociones';
import pandemic from './pandemic';

export const EXPERIMENTS: Record<string, ExperimentFlow> = {
  experiment: pandemic,
  'ejercicio-1': ejercicio1,
  emociones,
};
