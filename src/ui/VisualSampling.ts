import {createContext} from 'react';
// Optional sampling clock supplied by an isolated capture entry. Normal app
// providers are absent, so native presentation animation keeps its real clock.
export const VisualSamplingContext=createContext<Readonly<{recordPhase:number}>|undefined>(undefined);
