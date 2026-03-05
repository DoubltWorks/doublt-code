import { useState, useCallback } from 'react';

export type OverlayType =
  | 'sessionList'
  | 'workspaceList'
  | 'help'
  | 'pairingQR'
  | 'commandPalette'
  | null;

interface UseOverlayReturn {
  activeOverlay: OverlayType;
  openOverlay: (type: NonNullable<OverlayType>) => void;
  closeOverlay: () => void;
  toggleOverlay: (type: NonNullable<OverlayType>) => void;
}

export function useOverlay(): UseOverlayReturn {
  const [activeOverlay, setActiveOverlay] = useState<OverlayType>(null);

  const openOverlay = useCallback((type: NonNullable<OverlayType>) => {
    setActiveOverlay(type);
  }, []);

  const closeOverlay = useCallback(() => {
    setActiveOverlay(null);
  }, []);

  const toggleOverlay = useCallback((type: NonNullable<OverlayType>) => {
    setActiveOverlay((prev) => (prev === type ? null : type));
  }, []);

  return { activeOverlay, openOverlay, closeOverlay, toggleOverlay };
}
