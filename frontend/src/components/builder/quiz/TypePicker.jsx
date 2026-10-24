import { ListChecks, TextCursorInput, MousePointerClick, MapPin, Calculator, MessageSquareText } from "lucide-react";
import { TYPES } from "./quizModel";

const ICONS = {
  mcq: ListChecks,
  fill_blanks: TextCursorInput,
  drag_drop_word: MousePointerClick,
  drag_drop_image: MapPin,
  calculated_mcq: Calculator,
  keyword_match: MessageSquareText,
};

const DEMOS = {
  mcq: <>Which is a noble gas? <b>● Neon</b> ○ Oxygen ○ Iron</>,
  fill_blanks: <>Water boils at <b>[100]</b> °C.</>,
  drag_drop_word: <>The <b>[nucleus]</b> controls the <b>[cell]</b>.</>,
  drag_drop_image: <>Drag <b>Heart</b>, <b>Lungs</b> onto a diagram.</>,
  calculated_mcq: <>{"{{m}}"} kg × {"{{a}}"} m/s² = <b>? N</b></>,
  keyword_match: <>Explain osmosis. → needs <b>water</b>, <b>membrane</b></>,
};

export function TypeIcon({ type, small }) {
  const Icon = ICONS[type] || ListChecks;
  return (
    <span className={`qs-icon qs-t-${type} ${small ? "sm" : ""}`}>
      <Icon size={small ? 15 : 18} />
    </span>
  );
}

export default function TypePicker({ onPick }) {
  return (
    <div className="qs-picker" role="list">
      {Object.entries(TYPES).map(([type, t]) => (
        <button key={type} type="button" role="listitem" className={`qs-type qs-t-${type}`} onClick={() => onPick(type)}>
          <TypeIcon type={type} />
          <strong>{t.label}</strong>
          <span>{t.blurb}</span>
          <div className="qs-type-demo">{DEMOS[type]}</div>
        </button>
      ))}
    </div>
  );
}
