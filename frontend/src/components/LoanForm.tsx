"use client";
import { useState } from "react";
import { signTransaction } from "@/lib/freighterClient";
import { submitSignedXdr } from "@/lib/stellarUtils";
import { colors } from "@/lib/design-tokens";

interface Props {
  walletAddress: string;
  initialCollateralId?: string;
}

const ANIMAL_TYPES = ["cattle", "goat", "sheep"];
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

// ── Validation rules ────────────────────────────────────────────────────────

function validateCount(v: string): string | null {
  if (!v.trim()) return "Count is required.";
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return "Count must be a whole number of at least 1.";
  if (n > 10_000) return "Count cannot exceed 10,000.";
  return null;
}

function validateAppraisedValue(v: string): string | null {
  if (!v.trim()) return "Appraised value is required.";
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "Appraised value must be a positive number.";
  if (!Number.isInteger(n)) return "Appraised value must be a whole number of stroops.";
  return null;
}

function validateCollateralId(v: string): string | null {
  if (!v.trim()) return "Collateral ID is required.";
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) return "Collateral ID must be a positive integer.";
  return null;
}

function validateLoanAmount(v: string): string | null {
  if (!v.trim()) return "Loan amount is required.";
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return "Loan amount must be a positive number.";
  if (!Number.isInteger(n)) return "Loan amount must be a whole number of stroops.";
  if (n < 1_000) return "Loan amount must be at least 1,000 stroops.";
  return null;
}

// ── Field error display ──────────────────────────────────────────────────────

function FieldError({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return <p className="text-red-600 text-xs mt-1" role="alert">{msg}</p>;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LoanForm({ walletAddress, initialCollateralId }: Props) {
  const [step, setStep] = useState<"collateral" | "loan">(initialCollateralId ? "loan" : "collateral");

  // Collateral step fields
  const [animalType, setAnimalType] = useState("cattle");
  const [count, setCount] = useState("");
  const [appraisedValue, setAppraisedValue] = useState("");

  // Loan step fields
  const [collateralId, setCollateralId] = useState(initialCollateralId || "");
  const [loanAmount, setLoanAmount] = useState("");

  // Touched tracks which fields have been blurred at least once
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Derived errors ──────────────────────────────────────────────────────────

  const collateralErrors = {
    count: validateCount(count),
    appraisedValue: validateAppraisedValue(appraisedValue),
  };
  const loanErrors = {
    collateralId: validateCollateralId(collateralId),
    loanAmount: validateLoanAmount(loanAmount),
  };

  const collateralHasErrors = Object.values(collateralErrors).some(Boolean);
  const loanHasErrors = Object.values(loanErrors).some(Boolean);

  function touch(field: string) {
    setTouched((prev) => ({ ...prev, [field]: true }));
  }

  function touchAll(fields: string[]) {
    setTouched((prev) => Object.fromEntries([...Object.entries(prev), ...fields.map((f) => [f, true])]));
  }

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function registerCollateral() {
    touchAll(["count", "appraisedValue"]);
    if (collateralHasErrors) return;

    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API}/api/collateral/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: walletAddress,
          animal_type: animalType,
          count: parseInt(count),
          appraised_value: parseInt(appraisedValue),
        }),
      });
      const { xdr } = await res.json();
      const { signedTxXdr } = await signTransaction(xdr, { network: process.env.NEXT_PUBLIC_NETWORK || "TESTNET" });
      const result = await submitSignedXdr(signedTxXdr);
      setStatus(`✅ Collateral registered! ID: ${result}`);
      setStep("loan");
    } catch (e: any) {
      setStatus(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function requestLoan() {
    touchAll(["collateralId", "loanAmount"]);
    if (loanHasErrors) return;

    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`${API}/api/loan/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          borrower: walletAddress,
          collateral_id: parseInt(collateralId),
          amount: parseInt(loanAmount),
        }),
      });
      const { xdr } = await res.json();
      const { signedTxXdr } = await signTransaction(xdr, { network: process.env.NEXT_PUBLIC_NETWORK || "TESTNET" });
      const result = await submitSignedXdr(signedTxXdr);
      setStatus(`✅ Loan disbursed! Loan ID: ${result}`);
    } catch (e: any) {
      setStatus(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  }

  const inputClass = (hasError: boolean) =>
    `w-full rounded-lg px-3 py-2 ${colors.form.input} ${colors.text.primary} ${colors.form.placeholder} ${
      hasError ? "border-red-500 focus:ring-red-400" : ""
    }`;

  if (loading && step === "collateral") return null;

  return (
    <div className={`${colors.background.card} rounded-2xl p-6 shadow mt-6 space-y-4`}>
      {step === "collateral" ? (
        <>
          <h2 className={`text-xl font-semibold ${colors.text.primary}`}>1. Register Collateral</h2>

          <select
            className={`w-full ${colors.form.input} rounded-lg px-3 py-2 ${colors.text.primary}`}
            value={animalType}
            onChange={(e) => setAnimalType(e.target.value)}
          >
            {ANIMAL_TYPES.map((a) => <option key={a}>{a}</option>)}
          </select>

          <div>
            <input
              className={inputClass(!!touched.count && !!collateralErrors.count)}
              placeholder="Count"
              value={count}
              type="number"
              min={1}
              onChange={(e) => setCount(e.target.value)}
              onBlur={() => touch("count")}
              aria-describedby="count-error"
            />
            {touched.count && <FieldError msg={collateralErrors.count} />}
          </div>

          <div>
            <input
              className={inputClass(!!touched.appraisedValue && !!collateralErrors.appraisedValue)}
              placeholder="Appraised value (stroops)"
              value={appraisedValue}
              type="number"
              min={1}
              onChange={(e) => setAppraisedValue(e.target.value)}
              onBlur={() => touch("appraisedValue")}
              aria-describedby="appraisedValue-error"
            />
            {touched.appraisedValue && <FieldError msg={collateralErrors.appraisedValue} />}
          </div>

          <button
            onClick={registerCollateral}
            disabled={loading || (Object.values(touched).some(Boolean) && collateralHasErrors)}
            className={`w-full ${colors.primary.bg} ${colors.primary.text} py-2.5 rounded-xl font-semibold ${colors.primary.hover} transition ${colors.interactive.disabled} ${colors.interactive.focus}`}
          >
            {loading ? "Processing…" : "Register & Continue"}
          </button>
        </>
      ) : (
        <>
          <h2 className={`text-xl font-semibold ${colors.text.primary}`}>2. Request Loan</h2>

          <div>
            <input
              className={inputClass(!!touched.collateralId && !!loanErrors.collateralId)}
              placeholder="Collateral ID"
              value={collateralId}
              type="number"
              min={1}
              onChange={(e) => setCollateralId(e.target.value)}
              onBlur={() => touch("collateralId")}
              aria-describedby="collateralId-error"
            />
            {touched.collateralId && <FieldError msg={loanErrors.collateralId} />}
          </div>

          <div>
            <input
              className={inputClass(!!touched.loanAmount && !!loanErrors.loanAmount)}
              placeholder="Loan amount (stroops)"
              value={loanAmount}
              type="number"
              min={1000}
              onChange={(e) => setLoanAmount(e.target.value)}
              onBlur={() => touch("loanAmount")}
              aria-describedby="loanAmount-error"
            />
            {touched.loanAmount && <FieldError msg={loanErrors.loanAmount} />}
          </div>

          <button
            onClick={requestLoan}
            disabled={loading || (Object.values(touched).some(Boolean) && loanHasErrors)}
            className={`w-full ${colors.secondary.bg} ${colors.secondary.text} py-2.5 rounded-xl font-semibold ${colors.secondary.hover} transition ${colors.interactive.disabled} ${colors.interactive.focus}`}
          >
            {loading ? "Processing…" : "Request Loan"}
          </button>
        </>
      )}

      {status && (
        <p className={`text-sm mt-2 ${status.includes("❌") ? colors.status.error.text : colors.status.success.text}`}>
          {status}
        </p>
      )}
    </div>
  );
}
