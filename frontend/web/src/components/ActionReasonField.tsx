import { useId } from 'react';
import { Textarea } from '@/components/ui/textarea';

/** A shared functional dialog variant, without changing the product's visual foundation. */
export const permissionDialogClass = 'min-w-0 [overflow-wrap:anywhere] [&_*]:min-w-0 [&_button]:min-h-11 [&_button]:min-w-11 [&_button]:whitespace-normal [&_button]:h-auto [&_input]:max-w-full [&_textarea]:max-w-full';

export function validActionReason(value: string): boolean {
  const normalized = value.replace(/[\u0000-\u001f\u007f\s]+/g, ' ').trim();
  return [...normalized].length >= 1 && [...normalized].length <= 200;
}

export function ActionReasonField({ value, onChange, disabled }: {
  value: string; onChange(value: string): void; disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">Alasan tindakan</label>
      <Textarea id={id} value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
        required aria-describedby={`${id}-help`} aria-invalid={value !== '' && !validActionReason(value)} />
      <p id={`${id}-help`} className="m-0 text-sm text-muted-foreground">
        Wajib diisi, maksimal 200 karakter. Alasan dicatat bersama tindakan Anda. Jangan masukkan data pribadi atau rahasia.
      </p>
    </div>
  );
}
