import { ArrowClockwise } from '@phosphor-icons/react';
import { Component } from 'react';
import { Container } from './Page.jsx';
import { Button, ButtonLink } from '../ui/Button.jsx';

// Catches a page that crashes or whose code chunk fails to download (a dropped connection, or an old tab
// after a new deploy), so the navbar and footer stay up and the shopper gets a way out instead of a blank
// screen. Keyed by path in Layout, so moving to another page clears it.
export class PageErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    const chunk = /dynamically imported module|Loading chunk|Importing a module script failed/i.test(this.state.error.message);
    return (
      <Container>
        <div role="alert" className="flex flex-col items-center gap-3 px-6 py-24 text-center">
          <h1 className="wide text-xl font-bold text-ink">Something went wrong</h1>
          <p className="max-w-sm text-sm text-ink-2">
            {chunk
              ? "This page didn't finish downloading. Check your connection, then reload."
              : 'This page ran into a problem. Reloading usually fixes it.'}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={() => window.location.reload()}>
              <ArrowClockwise size={16} /> Reload page
            </Button>
            <ButtonLink to="/" variant="secondary" size="sm">
              Go to home
            </ButtonLink>
          </div>
        </div>
      </Container>
    );
  }
}
