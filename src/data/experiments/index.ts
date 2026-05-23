import { ExperimentFlow } from '@/lib/types';
import pandemic from './pandemic';
import ejercicio1 from './ejercicio-1';

export const EXPERIMENTS: Record<string, ExperimentFlow> = {
  experiment: pandemic,
  'ejercicio-1': ejercicio1,
};
