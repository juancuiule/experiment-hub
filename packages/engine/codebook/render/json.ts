import { Codebook } from '../types';

export function toJson(codebook: Codebook): string {
  return JSON.stringify(codebook, null, 2);
}
