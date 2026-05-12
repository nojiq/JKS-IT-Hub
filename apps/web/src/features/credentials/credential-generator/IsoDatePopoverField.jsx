import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

const pad2 = (n) => String(n).padStart(2, "0");

/** Parse `YYYY-MM-DD` to a local calendar Date (no UTC shift). */
const parseIsoDateToLocal = (value) => {
    if (!value || !ISO_RE.test(value)) {
        return undefined;
    }
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
};

const normalizeTwoDigitYear = (y) => {
    if (y >= 1000) {
        return y;
    }
    if (y >= 0 && y <= 99) {
        return y <= 30 ? 2000 + y : 1900 + y;
    }
    return y;
};

/**
 * Parse typed value: ISO `YYYY-MM-DD`, or `d/m/y` with `/` `.` `-` (day first, month second).
 */
const parseLooseDateToLocal = (raw) => {
    const s = String(raw ?? "").trim();
    if (!s) {
        return undefined;
    }
    const iso = parseIsoDateToLocal(s);
    if (iso) {
        return iso;
    }
    const m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
    if (!m) {
        return undefined;
    }
    const day = Number(m[1]);
    const month = Number(m[2]);
    const year = normalizeTwoDigitYear(Number(m[3]));
    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return undefined;
    }
    const dt = new Date(year, month - 1, day);
    if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) {
        return undefined;
    }
    return dt;
};

const formatDdMmYyyy = (date) =>
    `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;

/** Up to 8 digits → `dd/mm/yyyy` with slashes inserted automatically. */
const maskDigitsAsDdMmYyyy = (digits) => {
    if (!digits) {
        return "";
    }
    if (digits.length <= 2) {
        return digits;
    }
    if (digits.length <= 4) {
        return `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

/**
 * Text field for typing a date plus a calendar icon that opens `DayPicker` (month/year dropdowns).
 */
const IsoDatePopoverField = ({
    id,
    value,
    onChange,
    placeholder = "dd/mm/yyyy",
    "aria-invalid": ariaInvalid,
    title: titleProp
}) => {
    const rootRef = useRef(null);
    const inputRef = useRef(null);
    const pendingCursorRef = useRef(null);
    const [open, setOpen] = useState(false);
    const dialogId = useId();
    const selected = parseLooseDateToLocal(value);
    const now = new Date();
    const endYear = now.getFullYear();
    const startMonth = new Date(1900, 0);
    const endMonth = new Date(endYear, 11);

    useEffect(() => {
        if (!open) {
            return undefined;
        }
        const onDocMouse = (event) => {
            const node = rootRef.current;
            if (node && !node.contains(event.target)) {
                setOpen(false);
            }
        };
        const onKey = (event) => {
            if (event.key === "Escape") {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDocMouse);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDocMouse);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    useLayoutEffect(() => {
        const pending = pendingCursorRef.current;
        pendingCursorRef.current = null;
        const el = inputRef.current;
        if (!el || !pending) {
            return;
        }
        if (pending.mode === "iso") {
            const pos = Math.min(pending.pos, el.value.length);
            el.setSelectionRange(pos, pos);
            return;
        }
        const goal = pending.goal;
        if (goal <= 0) {
            el.setSelectionRange(0, 0);
            return;
        }
        let seen = 0;
        let pos = el.value.length;
        for (let i = 0; i < el.value.length; i += 1) {
            if (/\d/.test(el.value[i])) {
                seen += 1;
                if (seen >= goal) {
                    pos = i + 1;
                    break;
                }
            }
        }
        el.setSelectionRange(pos, pos);
    }, [value]);

    const calendarTitle =
        titleProp ?? "Open calendar. Month and year lists support keyboard search.";

    const handleTextChange = (event) => {
        const raw = event.target.value;
        const sel = event.target.selectionStart ?? raw.length;
        if (raw.includes("-")) {
            pendingCursorRef.current = { mode: "iso", pos: sel };
            onChange(raw);
            return;
        }
        if (
            !/[-/]/.test(raw) &&
            /^\d{1,4}$/.test(raw) &&
            raw.length >= 3 &&
            (raw.startsWith("19") || raw.startsWith("20"))
        ) {
            pendingCursorRef.current = { mode: "iso", pos: sel };
            onChange(raw);
            return;
        }
        const digitsLeft = raw.slice(0, sel).replace(/\D/g, "").length;
        const digits = raw.replace(/\D/g, "").slice(0, 8);
        const formatted = maskDigitsAsDdMmYyyy(digits);
        pendingCursorRef.current = { mode: "digits", goal: digitsLeft };
        onChange(formatted);
    };

    return (
        <div className="actual-password-dob-anchor" ref={rootRef}>
            <div className="imap-generator-input actual-password-dob-input-wrap">
                <input
                    ref={inputRef}
                    aria-invalid={ariaInvalid}
                    autoComplete="bday"
                    className="actual-password-dob-text"
                    id={id}
                    inputMode="text"
                    maxLength={10}
                    onChange={handleTextChange}
                    placeholder={placeholder}
                    type="text"
                    value={value}
                />
                <button
                    aria-controls={open ? dialogId : undefined}
                    aria-expanded={open}
                    aria-haspopup="dialog"
                    aria-label="Open date calendar"
                    className="actual-password-dob-calendar-button"
                    onClick={(event) => {
                        event.preventDefault();
                        setOpen((o) => !o);
                    }}
                    title={calendarTitle}
                    type="button"
                >
                    <svg aria-hidden fill="none" height="18" viewBox="0 0 24 24" width="18">
                        <path
                            d="M8 2v3M16 2v3M3.5 9h17M21 8.6V19a1.6 1.6 0 0 1-1.6 1.6H4.6A1.6 1.6 0 0 1 3 19V8.6A1.6 1.6 0 0 1 4.6 7h14.8A1.6 1.6 0 0 1 21 8.6Z"
                            stroke="currentColor"
                            strokeLinecap="round"
                            strokeWidth="1.6"
                        />
                    </svg>
                </button>
            </div>
            {open ? (
                <div
                    aria-label="Choose date"
                    className="actual-password-dob-popover"
                    id={dialogId}
                    role="dialog"
                >
                    <DayPicker
                        captionLayout="dropdown"
                        defaultMonth={selected ?? new Date(1990, 0)}
                        endMonth={endMonth}
                        mode="single"
                        onSelect={(date) => {
                            onChange(date ? formatDdMmYyyy(date) : "");
                            setOpen(false);
                        }}
                        selected={selected}
                        startMonth={startMonth}
                    />
                </div>
            ) : null}
        </div>
    );
};

export default IsoDatePopoverField;
