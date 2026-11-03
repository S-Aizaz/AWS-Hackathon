import { useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils } from 'three';
import { RESUME_DELAY_MS } from '../config';

/**
 * Produces a 0..1 speed factor for auto-rotation:
 *  - drops to 0 quickly when the user starts dragging/zooming,
 *  - stays at 0 until `delayMs` after the interaction ends,
 *  - then eases back up to 1 so the restart isn't jarring.
 * When `enabled` is false (spin switched off) it eases to 0 and stays there.
 *
 * Wire `onStart`/`onEnd` to OrbitControls, and pass `factorRef` to <Globe>.
 * Must be called inside the <Canvas> tree (uses useFrame).
 */
export function useIdleAutoRotate(enabled = true, delayMs = RESUME_DELAY_MS) {
  const factorRef = useRef(enabled ? 1 : 0);
  const interactingRef = useRef(false);
  const lastInteractionEndRef = useRef(Number.NEGATIVE_INFINITY);

  const onStart = useCallback(() => {
    interactingRef.current = true;
  }, []);

  const onEnd = useCallback(() => {
    interactingRef.current = false;
    lastInteractionEndRef.current = performance.now();
  }, []);

  useFrame((_, delta) => {
    const idle = !interactingRef.current && performance.now() - lastInteractionEndRef.current > delayMs;
    const spinning = enabled && idle;
    // Fast stop on grab (λ=10), softer stop when switched off (λ=4), gentle ~2 s ramp-up (λ=1.5).
    // damp() is frame-rate independent.
    const lambda = spinning ? 1.5 : enabled ? 10 : 4;
    const target = spinning ? 1 : 0;
    const next = MathUtils.damp(factorRef.current, target, lambda, Math.min(delta, 0.1));
    // damp() only approaches its target asymptotically; snap the last bit so "stopped" is truly still.
    factorRef.current = Math.abs(next - target) < 1e-3 ? target : next;
  });

  return { factorRef, onStart, onEnd };
}
