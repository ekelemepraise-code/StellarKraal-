import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoanForm from "../components/LoanForm";

const mockSignTransaction = jest.fn();
const mockSubmitSignedXdr = jest.fn();

jest.mock("@stellar/freighter-api", () => ({
  signTransaction: (...args: any[]) => mockSignTransaction(...args),
}));

jest.mock("../lib/stellarUtils", () => ({
  submitSignedXdr: (...args: any[]) => mockSubmitSignedXdr(...args),
  healthColor: () => "#16a34a",
  formatStroops: (s: number) => `${s / 1e7} XLM`,
}));

const fetchMock = jest.fn();
beforeEach(() => {
  fetchMock.mockReset();
  mockSignTransaction.mockReset();
  mockSubmitSignedXdr.mockReset();
  (global as any).fetch = fetchMock;
});

describe("LoanForm — existing behaviour", () => {
  it("renders collateral step by default", () => {
    render(<LoanForm walletAddress="GTEST" />);
    expect(screen.getByText("1. Register Collateral")).toBeTruthy();
    expect(screen.getByText("Register & Continue")).toBeTruthy();
  });

  it("renders animal type options", () => {
    render(<LoanForm walletAddress="GTEST" />);
    expect(screen.getByText("cattle")).toBeTruthy();
    expect(screen.getByText("goat")).toBeTruthy();
    expect(screen.getByText("sheep")).toBeTruthy();
  });

  it("advances to loan step after successful collateral registration", async () => {
    fetchMock.mockResolvedValue({ json: async () => ({ xdr: "test-xdr" }) });
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "signed-xdr" });
    mockSubmitSignedXdr.mockResolvedValue("collateral-id-123");

    render(<LoanForm walletAddress="GTEST" />);
    fireEvent.change(screen.getByPlaceholderText("Count"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("Appraised value (stroops)"), { target: { value: "1000000" } });
    fireEvent.click(screen.getByText("Register & Continue"));

    await waitFor(() => expect(screen.getByText("2. Request Loan")).toBeTruthy());
    expect(screen.getByText(/Collateral registered/)).toBeTruthy();
  });

  it("shows error status when collateral registration fails", async () => {
    fetchMock.mockRejectedValue(new Error("Network error"));

    render(<LoanForm walletAddress="GTEST" />);
    fireEvent.change(screen.getByPlaceholderText("Count"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("Appraised value (stroops)"), { target: { value: "1000000" } });
    fireEvent.click(screen.getByText("Register & Continue"));

    await waitFor(() => expect(screen.getByText("❌ Network error")).toBeTruthy());
  });

  it("submits loan request and shows success", async () => {
    fetchMock
      .mockResolvedValueOnce({ json: async () => ({ xdr: "xdr1" }) })
      .mockResolvedValueOnce({ json: async () => ({ xdr: "xdr2" }) });
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "signed" });
    mockSubmitSignedXdr.mockResolvedValue("loan-id-99");

    render(<LoanForm walletAddress="GTEST" />);
    fireEvent.change(screen.getByPlaceholderText("Count"), { target: { value: "3" } });
    fireEvent.change(screen.getByPlaceholderText("Appraised value (stroops)"), { target: { value: "500000" } });
    fireEvent.click(screen.getByText("Register & Continue"));

    await waitFor(() => screen.getByText("2. Request Loan"));

    fireEvent.change(screen.getByPlaceholderText("Collateral ID"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("Loan amount (stroops)"), { target: { value: "200000" } });
    fireEvent.click(screen.getByText("Request Loan"));

    await waitFor(() => expect(screen.getByText(/Loan disbursed/)).toBeTruthy());
  });

  it("shows error when loan request fails", async () => {
    fetchMock
      .mockResolvedValueOnce({ json: async () => ({ xdr: "xdr1" }) })
      .mockRejectedValueOnce(new Error("Loan failed"));
    mockSignTransaction.mockResolvedValue({ signedTxXdr: "signed" });
    mockSubmitSignedXdr.mockResolvedValue("col-1");

    render(<LoanForm walletAddress="GTEST" />);
    fireEvent.change(screen.getByPlaceholderText("Count"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("Appraised value (stroops)"), { target: { value: "100000" } });
    fireEvent.click(screen.getByText("Register & Continue"));

    await waitFor(() => screen.getByText("2. Request Loan"));
    fireEvent.change(screen.getByPlaceholderText("Collateral ID"), { target: { value: "1" } });
    fireEvent.change(screen.getByPlaceholderText("Loan amount (stroops)"), { target: { value: "5000" } });
    fireEvent.click(screen.getByText("Request Loan"));

    await waitFor(() => expect(screen.getByText("❌ Loan failed")).toBeTruthy());
  });
});

describe("LoanForm — collateral step validation", () => {
  it("shows count error on blur when empty", () => {
    render(<LoanForm walletAddress="GTEST" />);
    fireEvent.blur(screen.getByPlaceholderText("Count"));
    expect(screen.getByText("Count is required.")).toBeTruthy();
  });

  it("shows count error on blur for zero", () => {
    render(<LoanForm walletAddress="GTEST" />);
    fireEvent.change(screen.getByPlaceholderText("Count"), { target: { value: "0" } });
    fireEvent.blur(screen.getByPlaceholderText("Count"));
    expect(screen.getByText("Count must be a whole number of at least 1.")).toBeTruthy();
  });

  it("shows count error for non-integer", () => {
    render(<LoanForm walletAddress="GTEST" />);
    fireEvent.change(screen.getByPlaceholderText("Count"), { target: { value: "1.5" } });
    fireEvent.blur(screen.getByPlaceholderText("Count"));
    expect(screen.getByText("Count must be a whole number of at least 1.")).toBeTruthy();
  });

  it("shows appraised value error on blur when empty", () => {
    render(<LoanForm walletAddress="GTEST" />);
    fireEvent.blur(screen.getByPlaceholderText("Appraised value (stroops)"));
    expect(screen.getByText("Appraised value is required.")).toBeTruthy();
  });

  it("shows appraised value error for negative number", () => {
    render(<LoanForm walletAddress="GTEST" />);
    fireEvent.change(screen.getByPlaceholderText("Appraised value (stroops)"), { target: { value: "-100" } });
    fireEvent.blur(screen.getByPlaceholderText("Appraised value (stroops)"));
    expect(screen.getByText("Appraised value must be a positive number.")).toBeTruthy();
  });

  it("shows all collateral errors on submit with empty fields", () => {
    render(<LoanForm walletAddress="GTEST" />);
    fireEvent.click(screen.getByText("Register & Continue"));
    expect(screen.getByText("Count is required.")).toBeTruthy();
    expect(screen.getByText("Appraised value is required.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call fetch when collateral fields are invalid on submit", () => {
    render(<LoanForm walletAddress="GTEST" />);
    fireEvent.change(screen.getByPlaceholderText("Count"), { target: { value: "0" } });
    fireEvent.click(screen.getByText("Register & Continue"));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("disables submit button after a field is touched with an error", () => {
    render(<LoanForm walletAddress="GTEST" />);
    fireEvent.blur(screen.getByPlaceholderText("Count"));
    const btn = screen.getByText("Register & Continue").closest("button")!;
    expect(btn.disabled).toBe(true);
  });

  it("clears error once a valid value is entered", () => {
    render(<LoanForm walletAddress="GTEST" />);
    fireEvent.blur(screen.getByPlaceholderText("Count"));
    expect(screen.getByText("Count is required.")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("Count"), { target: { value: "5" } });
    expect(screen.queryByText("Count is required.")).toBeNull();
  });
});

describe("LoanForm — loan step validation", () => {
  function renderAtLoanStep() {
    render(<LoanForm walletAddress="GTEST" initialCollateralId="42" />);
  }

  it("shows collateral ID error on blur when empty", () => {
    renderAtLoanStep();
    fireEvent.change(screen.getByPlaceholderText("Collateral ID"), { target: { value: "" } });
    fireEvent.blur(screen.getByPlaceholderText("Collateral ID"));
    expect(screen.getByText("Collateral ID is required.")).toBeTruthy();
  });

  it("shows loan amount error on blur when empty", () => {
    renderAtLoanStep();
    fireEvent.change(screen.getByPlaceholderText("Loan amount (stroops)"), { target: { value: "" } });
    fireEvent.blur(screen.getByPlaceholderText("Loan amount (stroops)"));
    expect(screen.getByText("Loan amount is required.")).toBeTruthy();
  });

  it("shows loan amount error when below minimum", () => {
    renderAtLoanStep();
    fireEvent.change(screen.getByPlaceholderText("Loan amount (stroops)"), { target: { value: "500" } });
    fireEvent.blur(screen.getByPlaceholderText("Loan amount (stroops)"));
    expect(screen.getByText("Loan amount must be at least 1,000 stroops.")).toBeTruthy();
  });

  it("shows all loan errors on submit with empty fields", () => {
    // Use a valid collateralId to reach the loan step, then clear it
    render(<LoanForm walletAddress="GTEST" initialCollateralId="1" />);
    fireEvent.change(screen.getByPlaceholderText("Collateral ID"), { target: { value: "" } });
    fireEvent.click(screen.getByText("Request Loan"));
    expect(screen.getByText("Collateral ID is required.")).toBeTruthy();
    expect(screen.getByText("Loan amount is required.")).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("disables submit button after a loan field is touched with an error", () => {
    renderAtLoanStep();
    fireEvent.blur(screen.getByPlaceholderText("Loan amount (stroops)"));
    const btn = screen.getByText("Request Loan").closest("button")!;
    expect(btn.disabled).toBe(true);
  });
});
