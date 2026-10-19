import { ThumbsDown, ThumbsUp } from '@phosphor-icons/react';
import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useToast } from '../../providers/ToastProvider.jsx';

// "Helpful?" with a thumbs up and down. A tap shows at once and is sent in the background; if the server says no,
// it goes back and says why. Tapping your current vote takes it back. `blocked` is why this viewer can't vote
// (signed out, their own review, the shop's own product), shown instead of sending.
export function ReviewVotes({ review, blocked }) {
  const toast = useToast();
  const [state, setState] = useState({
    likes: review.likes ?? 0,
    dislikes: review.dislikes ?? 0,
    mine: review.myVote ?? null,
  });
  const [seen, setSeen] = useState(review);
  if (seen !== review) {
    // A refetch brought fresh counts.
    setSeen(review);
    setState({ likes: review.likes ?? 0, dislikes: review.dislikes ?? 0, mine: review.myVote ?? null });
  }

  const cast = async (vote) => {
    if (blocked) return toast.show(blocked);
    const next = state.mine === vote ? null : vote;
    const previous = state;
    setState({
      likes: state.likes - (state.mine === 'up') + (next === 'up'),
      dislikes: state.dislikes - (state.mine === 'down') + (next === 'down'),
      mine: next,
    });
    try {
      const res = await api(`/reviews/${review._id}/vote`, { method: 'PUT', body: { vote: next ?? 'none' } });
      setState({ likes: res.likes, dislikes: res.dislikes, mine: res.myVote });
    } catch (err) {
      setState(previous);
      toast.error(err.message);
    }
  };

  const button = (vote, Icon, count, label) => {
    const on = state.mine === vote;
    return (
      <button
        type="button"
        aria-pressed={on}
        onClick={() => cast(vote)}
        aria-label={`${label} (${count})`}
        className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 font-mono text-[12px] tabular-nums transition-colors ${
          on
            ? 'border-accent-ink/60 bg-accent/12 text-accent-ink'
            : 'border-seam text-ink-3 hover:border-edge hover:text-ink'
        } ${blocked ? 'cursor-default opacity-70' : ''}`}
      >
        <Icon size={15} weight={on ? 'fill' : 'regular'} /> {count}
      </button>
    );
  };

  return (
    <div className="flex items-center gap-2 text-[12px] text-ink-3">
      <span>Helpful?</span>
      {button('up', ThumbsUp, state.likes, 'Helpful')}
      {button('down', ThumbsDown, state.dislikes, 'Not helpful')}
    </div>
  );
}
