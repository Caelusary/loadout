import { Heart, IdentificationCard, Package, ShieldCheck, Storefront, Tag, Truck } from '@phosphor-icons/react';

// The signed-in user's destinations, shared by the desktop account menu and the phone menu. Account settings is
// reached from the name card at the top of both, so it isn't listed. `workspace` is the role's own panel (or, for a
// customer, the way to start selling); `you` is the shopping side, only for roles that shop.
export const accountSections = ({ user, isAdmin, isSeller, isRider, canShop }) => ({
  workspace: [
    ...(isAdmin ? [['/admin', 'Admin panel', ShieldCheck]] : []),
    ...(isSeller ? [['/seller', 'Seller Center', Storefront]] : []),
    ...(isRider
      ? [
          ['/deliveries', 'Deliveries', Truck],
          ['/account/rider', 'Delivery profile', IdentificationCard],
        ]
      : []),
    ...(user.role === 'customer' ? [['/account/sell', 'Sell on Loadout', Tag]] : []),
  ],
  you: canShop
    ? [
        ['/account/orders', 'My orders', Package],
        ['/account/wishlist', 'Wishlist', Heart],
      ]
    : [],
});

// Headings say what the links are for, so each role reads its own job first.
export const sectionLabel = (key, { isAdmin, isRider }) =>
  key === 'you' ? 'Shopping' : isAdmin ? 'Admin' : isRider ? 'Delivering' : 'Selling';
