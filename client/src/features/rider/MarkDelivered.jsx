import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin } from '@phosphor-icons/react';
import { useState } from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { ConfirmDialog } from '../../components/ui/Dialog.jsx';
import { api } from '../../lib/api.js';
import { orderNumber } from '../../lib/format.js';
import { useToast } from '../../providers/ToastProvider.jsx';
import { ProofPhoto } from './ProofPhoto.jsx';

// "Mark delivered" with a photo of the parcel at the door, like Shopee and Lazada riders take. The buyer and shop see
// the photo; the phone's location, if the rider allows it, is kept for admins only, as evidence if the buyer says it
// never came. The photo is required; the location is not.
export function MarkDelivered({ order }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState(null); // the uploaded photo's address
  const [missing, setMissing] = useState(false); // tried to finish without a photo
  const [location, setLocation] = useState(null); // { lat, lng, accuracy } | 'denied' | null while asking

  const start = () => {
    setOpen(true);
    setPhoto(null);
    setMissing(false);
    setLocation(null);
    if (!navigator.geolocation) return setLocation('denied');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => setLocation({ lat: coords.latitude, lng: coords.longitude, accuracy: coords.accuracy }),
      () => setLocation('denied'),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  };

  const deliver = useMutation({
    mutationFn: () =>
      api(`/deliveries/${order._id}`, {
        method: 'PATCH',
        body: {
          status: 'delivered',
          proof: { url: photo, ...(typeof location === 'object' && location && { location }) },
        },
      }),
    onSuccess: () => {
      toast.show(`${orderNumber(order._id)} is delivered`);
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['order', order._id] });
    },
    onError: (err) => toast.error(err.fields?.proof ?? err.message),
  });

  return (
    <>
      <Button className="max-sm:w-full" onClick={start}>
        Mark delivered
      </Button>
      <ConfirmDialog
        open={open}
        title={`Deliver ${orderNumber(order._id)}`}
        confirmLabel="Mark delivered"
        cancelLabel="Not yet"
        tone="primary"
        pending={deliver.isPending}
        onConfirm={() => (photo ? deliver.mutate() : setMissing(true))}
        onClose={() => setOpen(false)}
      >
        <p>
          Take a photo of the parcel where you left it or in the buyer&apos;s hands. The buyer and the shop
          see it.
        </p>
        <div className="mt-4 flex flex-col gap-3">
          <ProofPhoto photo={photo} onPhoto={setPhoto} missing={missing} />
          <div className="flex items-start gap-2.5 rounded-control border border-seam bg-raised/50 px-3 py-2.5">
            <MapPin
              size={18}
              weight={location && location !== 'denied' ? 'fill' : 'regular'}
              aria-hidden="true"
              className={`mt-px shrink-0 ${location === null ? 'animate-pulse text-ink-3' : location === 'denied' ? 'text-ink-3' : 'text-ok'}`}
            />
            <div className="flex flex-col text-[13px]">
              <span className="font-medium text-ink">
                {location === null
                  ? 'Getting your location…'
                  : location === 'denied'
                    ? 'No location'
                    : `Location saved, within ${Math.round(location.accuracy)} m`}
              </span>
              <span className="text-ink-3">
                {location === 'denied'
                  ? "That's fine, the photo is enough."
                  : 'Only admins see it, and only if the buyer says it never came.'}
              </span>
            </div>
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}
