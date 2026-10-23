import { Component } from 'react';

// Catches anything that breaks inside a 3D view (a shader that won't compile, a driver error) and hands the page
// back to its photo through `onFail`, instead of the error taking the whole page down. Renders nothing once failed;
// the page shows its photo in its place.
export class ThreeGuard extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail?.();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
