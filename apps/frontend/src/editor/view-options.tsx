'use client';
import { createContext, useContext } from 'react';

/** Progressive-disclosure toggles — let the author pick how dense the graph is. */
export type ViewOptions = {
  /** Derived $$/@ producer→consumer overlay edges. */
  dataFlow: boolean;
  /** dataKey/output socket rows on screen/compute/data nodes. */
  fields: boolean;
  /** Component skeleton rows on screen nodes. */
  preview: boolean;
  /** Mid-edge pill labels. */
  labels: boolean;
  /** Prop detail rows (slug, items, weights…). Arm/handle rows always render. */
  details: boolean;
};

export const DEFAULT_VIEW_OPTIONS: ViewOptions = {
  dataFlow: true,
  fields: true,
  preview: true,
  labels: true,
  details: true,
};

export const ViewOptionsContext =
  createContext<ViewOptions>(DEFAULT_VIEW_OPTIONS);

export const useViewOptions = () => useContext(ViewOptionsContext);
