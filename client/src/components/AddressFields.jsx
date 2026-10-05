import { TextField } from './ui/fields.jsx';

// Renders the address inputs under a react-hook-form prefix such as "shippingAddress".
export function AddressFields({ register, errors = {}, prefix }) {
  const name = (field) => `${prefix}.${field}`;
  const error = (field) => errors?.[field]?.message;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <TextField label="Full name" autoComplete="name" placeholder="Who will receive the order" error={error('fullName')} {...register(name('fullName'))} />
      </div>
      <div className="sm:col-span-2">
        <TextField
          label="Street address"
          autoComplete="street-address"
          placeholder="Unit, building, street, barangay"
          error={error('line1')}
          {...register(name('line1'))}
        />
      </div>
      <TextField label="City" autoComplete="address-level2" placeholder="Enter your city" error={error('city')} {...register(name('city'))} />
      <TextField label="Province" autoComplete="address-level1" placeholder="Enter your province" error={error('province')} {...register(name('province'))} />
      <TextField
        label="Postal code"
        inputMode="numeric"
        autoComplete="postal-code"
        placeholder="e.g. 1101"
        error={error('postalCode')}
        {...register(name('postalCode'))}
      />
      <TextField
        label="Mobile number"
        type="tel"
        autoComplete="tel"
        placeholder="e.g. 0917 123 4567"
        error={error('phone')}
        {...register(name('phone'))}
      />
    </div>
  );
}
