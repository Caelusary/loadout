import { ReturnsList } from '../orders/ReturnsList.jsx';

export default function SellerReturns() {
  return (
    <ReturnsList
      title="Returns"
      description="Customers can return damaged, wrong or not-as-described items within 7 days of delivery. Approve or decline new ones; mark approved ones received when the item is back."
      endpoint="/returns/sold"
      statuses={['requested', 'approved', 'declined', 'escalated', 'refunded', 'closed']}
    />
  );
}
