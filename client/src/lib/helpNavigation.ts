import type { Location } from 'react-router-dom';

export type HelpBackState = {
  /** Route to return to from the help index “Back” (internal path only). */
  helpBack?: string;
};

/** Location state used when opening `/help` from the chrome (top bar or account menu). */
export function nextHelpOpenState(location: Pick<Location, 'pathname' | 'state'>): HelpBackState {
  const { pathname, state } = location;
  const fromHelp = pathname.startsWith('/help');
  const prev = state as HelpBackState | null;
  if (fromHelp && prev?.helpBack) {
    return { helpBack: prev.helpBack };
  }
  if (fromHelp) {
    return {};
  }
  return { helpBack: pathname || '/' };
}
