import type { Instrument } from "@/features/instruments/schemas/instrument.schema";
import { SelectField } from "@/shared/ui/input/select-field";

export type InstrumentPickerProps = {
  readonly instruments: readonly Instrument[];
  readonly name?: string;
  readonly label?: string;
  readonly exclude?: readonly string[];
};

export function InstrumentPicker({
  instruments,
  name = "instrumentId",
  label = "Instrument",
  exclude = [],
}: InstrumentPickerProps) {
  const available = instruments.filter((instrument) => !exclude.includes(instrument.id));

  return (
    <SelectField
      label={label}
      name={name}
      required
      defaultValue=""
      disabled={available.length === 0}
    >
      <option value="" disabled>
        {available.length === 0 ? "Nothing left to add" : "Select…"}
      </option>
      {available.map((instrument) => (
        <option key={instrument.id} value={instrument.id}>
          {instrument.ticker} — {instrument.name}
        </option>
      ))}
    </SelectField>
  );
}
