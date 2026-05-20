import { createContext, useContext, useState } from 'react';
import { getRegion, setRegion as saveRegion } from './regionStore';

const RegionContext = createContext(null);

export function RegionProvider({ children }) {
  const [region, setRegionState] = useState(getRegion);

  function changeRegion(code) {
    saveRegion(code);
    setRegionState(code);
  }

  return (
    <RegionContext.Provider value={{ region, changeRegion }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
