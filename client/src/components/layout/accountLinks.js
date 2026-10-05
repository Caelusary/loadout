// The signed-in user's destinations, shared by the desktop account menu and the phone account sheet.
export const accountLinks = ({ user, isAdmin, isSeller }) => [
  ...(isAdmin ? [['/admin', 'Admin']] : []),
  ...(isSeller ? [['/seller', 'Seller Center']] : []),
  ['/account', 'Profile'],
  ...(!isAdmin ? [['/account/orders', 'My orders'], ['/account/wishlist', 'Wishlist']] : []),
  ...(user.role === 'customer' ? [['/account/sell', 'Sell on Loadout']] : []),
];
