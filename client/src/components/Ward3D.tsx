import { useEffect, useRef } from 'react';
import { mountWardGame } from '../game3d/game';

export default function Ward3D() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    return mountWardGame(ref.current);
  }, []);

  return <div ref={ref} className="w-full h-[calc(100vh-65px)]" />;
}
