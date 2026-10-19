import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Bicycle, Car, Motorcycle, Star, Van } from '@phosphor-icons/react';
import { useState } from 'react';
import { PanelHeader } from '../../components/layout/PanelLayout.jsx';
import { useTitle } from '../../components/layout/Page.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { ErrorState, Skeleton } from '../../components/ui/feedback.jsx';
import { TextField } from '../../components/ui/fields.jsx';
import { api } from '../../lib/api.js';
import { VEHICLE_LABELS } from '../../lib/constants.js';
import { vehicleText } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { useRiderProfile } from './useRiderProfile.js';

// Shown on the profile and the deliveries page while an admin looks into a report.
export function HoldNotice({ held }) {
  if (!held) return null;
  return (
    <p role="status" className="rounded-panel border border-warn/50 bg-warn/5 px-4 py-3 text-sm text-ink-2">
      <span className="font-medium text-ink">You&apos;re paused from new deliveries.</span> An admin is
      looking at a report about one of your deliveries. Orders already out with you carry on as normal.
    </p>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-panel border border-seam bg-plate p-4">
      <span className="text-[13px] text-ink-3">{label}</span>
      <span className="font-mono text-2xl font-medium tabular-nums">{value}</span>
      {hint && <span className="text-[12px] text-ink-3">{hint}</span>}
    </div>
  );
}

// A rider's own details and record. Admins see the phone; buyers see the first name, vehicle and plate, and only
// while their order is on the way.
export default function RiderProfilePage() {
  useTitle('Delivery profile');
  const { data, isPending, isError, error, refetch } = useRiderProfile();

  const header = (
    <PanelHeader title="Delivery profile" description="Your record, and the details buyers and admins see." />
  );
  if (isError) {
    return (
      <>
        {header}
        <ErrorState error={error} onRetry={refetch} />
      </>
    );
  }
  if (isPending) {
    return (
      <>
        {header}
        {/* Shaped like the page: four record cards, then the vehicle cards, the two fields and Save. */}
        <div className="flex max-w-2xl flex-col gap-8" aria-busy="true" aria-label="Loading">
          <div className="flex flex-col gap-3">
            <Skeleton className="h-5 w-28" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex h-[92px] flex-col gap-2 rounded-panel border border-seam p-4">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-10" />
                </div>
              ))}
            </div>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
          <div className="flex flex-col gap-4">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-4/5" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Skeleton className="h-[62px]" />
              <Skeleton className="h-[62px]" />
            </div>
            <Skeleton className="h-11 w-32" />
          </div>
        </div>
      </>
    );
  }
  const { stats } = data;

  return (
    <>
      {header}
      <div className="flex max-w-2xl flex-col gap-8">
        <HoldNotice held={data.held} />
        <section aria-labelledby="record-heading" className="flex flex-col gap-3">
          <h2 id="record-heading" className="font-medium">
            Your record
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Delivered" value={stats.delivered} />
            <Stat label="To deliver" value={stats.onTheWay} />
            <Stat
              label="Rating"
              value={
                stats.ratingAvg == null ? (
                  '—'
                ) : (
                  <span className="inline-flex items-center gap-1">
                    {stats.ratingAvg.toFixed(1)}
                    <Star size={18} weight="fill" className="text-accent-ink" aria-hidden="true" />
                  </span>
                )
              }
              hint={
                stats.ratingCount
                  ? `from ${stats.ratingCount} buyer${stats.ratingCount === 1 ? '' : 's'}`
                  : 'No ratings yet'
              }
            />
            <Stat label="Turned down" value={stats.declinesThisWeek} hint="this week" />
          </div>
          <p className="text-[13px] text-ink-3">
            Higher-rated riders get offered orders first, but everyone gets work. Buyers rate you after they
            confirm an order arrived; you see the average, not who said what.
          </p>
        </section>
        <DetailsForm profile={data.profile} onTheWay={stats.onTheWay} />
      </div>
    </>
  );
}

const VEHICLE_ICONS = { motorcycle: Motorcycle, bicycle: Bicycle, car: Car, van: Van };

// Four picture cards instead of a dropdown: one tap, and it doesn't open in the phone's own light-colored picker.
function VehiclePicker({ value, error, onChange, disabled = false }) {
  return (
    <fieldset disabled={disabled} className="flex flex-col gap-1.5 disabled:opacity-60">
      <legend className="mb-1.5 text-[13px] font-medium text-ink-2">Vehicle</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Object.entries(VEHICLE_LABELS).map(([key, label]) => {
          const Icon = VEHICLE_ICONS[key];
          return (
            <label
              key={key}
              className="flex h-20 cursor-pointer flex-col in-disabled:cursor-not-allowed items-center justify-center gap-1.5 rounded-control border border-seam bg-raised text-sm text-ink-2 transition-colors hover:border-edge hover:text-ink has-checked:border-accent-ink has-checked:bg-accent/10 has-checked:text-accent-ink has-focus-visible:ring-2 has-focus-visible:ring-accent-ink/50"
            >
              <input
                type="radio"
                name="vehicle"
                value={key}
                checked={value === key}
                onChange={() => onChange(key)}
                className="sr-only"
              />
              <Icon size={26} weight={value === key ? 'fill' : 'regular'} aria-hidden="true" />
              {label}
            </label>
          );
        })}
      </div>
      {error && <p className="text-[13px] text-bad">{error}</p>}
    </fieldset>
  );
}

// Starts from the saved details; the page only mounts it once they've loaded. The vehicle and plate are what buyers
// look for at the door, so once set, a change goes to an admin (the current one stays in use until it's approved) and
// can't be asked for while an order is with the rider. The phone saves straight away.
function DetailsForm({ profile, onTheWay }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    phone: profile.phone ?? '',
    vehicle: profile.vehicle ?? '',
    plate: profile.plate ?? '',
  });
  const [errors, setErrors] = useState({});
  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const waiting = profile.vehicleRequest;
  const locked = Boolean(profile.vehicle) && onTheWay > 0;

  const saved = (res) => {
    queryClient.setQueryData(['rider-profile'], res);
    setErrors({});
    // The form goes back to the vehicle in use; a request shows in its own note above.
    setForm((f) => ({ ...f, vehicle: res.profile.vehicle ?? '', plate: res.profile.plate ?? '' }));
  };
  const withdraw = useMutation({
    mutationFn: () => api('/rider/profile', { method: 'PATCH', body: { cancelVehicleRequest: true } }),
    onSuccess: (res) => {
      saved(res);
      toast.show('Request withdrawn');
    },
    onError: (err) => toast.error(err.message),
  });
  const save = useMutation({
    mutationFn: () => api('/rider/profile', { method: 'PATCH', body: form }),
    onSuccess: (res) => {
      saved(res);
      toast.show(
        res.requested
          ? "Sent to an admin. You'll keep your current vehicle until it's approved."
          : 'Profile saved',
      );
    },
    // The server names fields by their path on the account, like riderProfile.plate.
    onError: (err) =>
      err.fields
        ? setErrors(
            Object.fromEntries(
              Object.entries(err.fields).map(([k, v]) => [k.replace('riderProfile.', ''), v]),
            ),
          )
        : toast.error(err.message),
  });

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="flex flex-col gap-4"
      aria-labelledby="details-heading"
    >
      <div>
        <h2 id="details-heading" className="font-medium">
          Your details
        </h2>
        <p className="text-[13px] text-ink-3">
          Buyers see your first name, vehicle and plate while you have their order, so an admin checks a
          vehicle change before they see it. Only admins see your phone.
        </p>
      </div>
      {waiting && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-panel border border-accent-ink/40 bg-accent/10 px-4 py-3 text-sm">
          <p className="min-w-0 flex-1 text-ink-2">
            <span className="font-medium text-ink">Waiting for an admin:</span> {vehicleText(waiting)}. You'll
            keep {vehicleText(profile)} until it's approved.
          </p>
          <Button variant="ghost" size="sm" loading={withdraw.isPending} onClick={() => withdraw.mutate()}>
            Withdraw
          </Button>
        </div>
      )}
      {locked && (
        <p className="text-[13px] text-ink-3">
          You can change your vehicle once your current deliveries are done: those buyers were told this one.
        </p>
      )}
      <VehiclePicker
        value={form.vehicle}
        disabled={locked}
        error={errors.vehicle}
        // A bicycle has no plate, so picking one clears it.
        onChange={(vehicle) =>
          setForm((f) => ({ ...f, vehicle, ...(vehicle === 'bicycle' && { plate: '' }) }))
        }
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Phone"
          inputMode="tel"
          placeholder="e.g. 09171234567"
          value={form.phone}
          error={errors.phone}
          onChange={set('phone')}
        />
        {form.vehicle !== 'bicycle' && (
          <TextField
            label="Plate"
            optional
            disabled={locked}
            placeholder="e.g. ABC 1234"
            value={form.plate}
            error={errors.plate}
            onChange={set('plate')}
          />
        )}
      </div>
      <Button type="submit" className="self-start" loading={save.isPending}>
        Save details
      </Button>
    </form>
  );
}
