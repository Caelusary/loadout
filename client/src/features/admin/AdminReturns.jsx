import { ReturnsList } from '../orders/ReturnsList.jsx';

export default function AdminReturns() {
  return (
    <ReturnsList
      title="Returns"
      description="Escalated returns are ones the customer disputes. Stuck ones are new or approved returns the shop hasn't moved for 3 days, or whose shop can't act. Your decisions are final and go in the activity log."
      endpoint="/admin/returns"
      statuses={['escalated', 'stuck', 'requested', 'approved', 'declined', 'refunded', 'closed']}
      showShop
    />
  );
}
