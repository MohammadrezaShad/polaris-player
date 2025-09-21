/** src/player/ui/floating/floating-layer-portal.tsx */
'use client';
import * as React from 'react';
import { createPortal } from 'react-dom';

type Props = {
  open: boolean;
  onOpenChange?: (o: boolean) => void;
  lockScroll?: boolean;
  focusTrap?: boolean;
  zIndex?: number;
  /** Mount inside this element (absolute). If omitted, mount fullscreen/body (fixed). */
  within?: Element | null;
  children: React.ReactNode;
};

export function FloatingLayerPortal({
  open,
  onOpenChange,
  lockScroll = false,
  focusTrap = true,
  zIndex = 1000,
  within = null,
  children,
}: Props) {
  const [root, setRoot] = React.useState<Element | null>(null);
  const [host, setHost] = React.useState<HTMLDivElement | null>(null); // ✅ stateful host
  const lastFocusRef = React.useRef<HTMLElement | null>(null);

  const pickRoot = React.useCallback(() => {
    if (within) return within;
    if (typeof document === 'undefined') return null;
    return (
      (document.fullscreenElement as Element | null) ||
      ((document as any).webkitFullscreenElement as Element | null) ||
      document.body
    );
  }, [within]);

  // establish root when opened (and track fullscreen if global)
  React.useEffect(() => {
    if (!open) return;
    setRoot(pickRoot());
    if (!within) {
      const onFs = () => setRoot(pickRoot());
      document.addEventListener('fullscreenchange', onFs);
      document.addEventListener('webkitfullscreenchange', onFs as any);
      return () => {
        document.removeEventListener('fullscreenchange', onFs);
        document.removeEventListener('webkitfullscreenchange', onFs as any);
      };
    }
  }, [open, pickRoot, within]);

  // create/destroy host (using state so we re-render as soon as it exists)
  React.useEffect(() => {
    if (!open || !root) return;
    const el = document.createElement('div');
    if (within) {
      el.style.position = 'absolute';
      el.style.inset = '0';
    } else {
      el.style.position = 'fixed';
      el.style.inset = '0';
    }
    el.style.zIndex = String(zIndex);
    el.setAttribute('data-floating-root', within ? 'local' : 'global');
    root.appendChild(el);
    setHost(el); // ← triggers re-render so createPortal runs immediately
    return () => {
      setHost(null);
      try {
        root.removeChild(el);
      } catch {}
    };
  }, [open, root, zIndex, within]);

  // lock scroll only for global overlays
  React.useEffect(() => {
    if (!open || !lockScroll || !root || within) return;
    const target = root === document.body ? document.body : (root as HTMLElement);
    const prev = target.style.overflow;
    target.style.overflow = 'hidden';
    return () => {
      target.style.overflow = prev;
    };
  }, [open, lockScroll, root, within]);

  // focus trap + ESC
  React.useEffect(() => {
    if (!open || !focusTrap || !host) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onOpenChange) onOpenChange(false);
      if (e.key !== 'Tab') return;
      const nodes = Array.from(
        host.querySelectorAll<HTMLElement>('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'),
      ).filter((el) => !el.hasAttribute('disabled') && !el.getAttribute('aria-hidden'));
      if (nodes.length === 0) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open, focusTrap, onOpenChange, host]);

  // store/restore focus
  React.useEffect(() => {
    if (open) lastFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    else lastFocusRef.current?.focus?.();
  }, [open]);

  if (!open || !host) return null; // wait until host exists
  return createPortal(children, host);
}
